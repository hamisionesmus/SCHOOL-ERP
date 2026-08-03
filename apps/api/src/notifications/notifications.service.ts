import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';

export interface NotificationItem {
  id: string;
  message: string;
  href: string;
  tone: 'info' | 'warning' | 'danger';
  read: boolean;
}

type ComputedItem = Omit<NotificationItem, 'read'>;

/**
 * A computed feed, not a persisted table — mirrors the Dashboard module's "server decides what's
 * included by permission" pattern (see DashboardService) rather than adding a new Notification model
 * that would need its own read/dismiss/retention lifecycle. Every item here is derived from data that
 * already exists and is already permission-scoped elsewhere in the app.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async list(user: JwtUserPayload): Promise<NotificationItem[]> {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];
    const items: ComputedItem[] = [];

    const tasks: Promise<void>[] = [];

    if (perms.includes('HR:EDIT')) {
      tasks.push(
        db.leaveRequest.count({ where: { status: 'PENDING' } }).then((n) => {
          if (n > 0) {
            items.push({
              id: 'leave-pending',
              message: `${n} leave request${n === 1 ? '' : 's'} awaiting approval`,
              href: '/school/hr',
              tone: 'warning',
            });
          }
        }),
      );
    }

    if (perms.includes('ADMISSION:MANAGE')) {
      tasks.push(
        db.application
          .count({ where: { status: { in: ['APPLIED', 'INTERVIEW', 'OFFERED', 'WAITLISTED'] } } })
          .then((n) => {
            if (n > 0) {
              items.push({
                id: 'admissions-pending',
                message: `${n} admission application${n === 1 ? '' : 's'} in the pipeline`,
                href: '/school/admissions',
                tone: 'info',
              });
            }
          }),
      );
    }

    if (perms.includes('TRANSPORT:MANAGE')) {
      tasks.push(
        db.trip.count({ where: { status: 'PROPOSED' } }).then((n) => {
          if (n > 0) {
            items.push({
              id: 'trips-pending',
              message: `${n} trip${n === 1 ? '' : 's'} awaiting your approval`,
              href: '/school/trips',
              tone: 'warning',
            });
          }
        }),
      );
    }

    if (perms.includes('INVENTORY:MANAGE')) {
      tasks.push(
        db.inventoryItem.findMany({ select: { quantity: true, reorderLevel: true } }).then((rows) => {
          const low = rows.filter((r) => r.quantity <= r.reorderLevel).length;
          if (low > 0) {
            items.push({
              id: 'inventory-low-stock',
              message: `${low} item${low === 1 ? '' : 's'} at or below reorder level`,
              href: '/school/inventory',
              tone: 'danger',
            });
          }
        }),
      );
    }

    if (perms.includes('EXAM:APPROVE')) {
      tasks.push(
        db.examSubject.count({ where: { status: 'SUBMITTED' } }).then((n) => {
          if (n > 0) {
            items.push({
              id: 'exam-subjects-submitted',
              message: `${n} subject mark-sheet${n === 1 ? '' : 's'} submitted for approval`,
              href: '/school/exams',
              tone: 'info',
            });
          }
        }),
      );
    }

    if (perms.includes('TICKET:MANAGE')) {
      tasks.push(
        db.ticket.count({ where: { status: 'OPEN' } }).then((n) => {
          if (n > 0) {
            items.push({
              id: 'tickets-open',
              message: `${n} open ticket${n === 1 ? '' : 's'} awaiting a reply`,
              href: '/school/tickets',
              tone: 'warning',
            });
          }
        }),
      );
    }

    if (perms.includes('FINANCE:EDIT') || perms.includes('FINANCE:APPROVE_INVOICE')) {
      tasks.push(
        db.invoice
          .count({ where: { status: { notIn: ['PAID', 'CANCELLED'] }, dueDate: { lt: new Date() } } })
          .then((n) => {
            if (n > 0) {
              items.push({
                id: 'invoices-overdue',
                message: `${n} invoice${n === 1 ? '' : 's'} overdue`,
                href: '/school/finance',
                tone: 'danger',
              });
            }
          }),
      );
    }

    if (perms.includes('STUDENT:VIEW_OWN_CHILD') || perms.includes('STUDENT:VIEW_OWN_RECORD')) {
      const where = perms.includes('STUDENT:VIEW_OWN_CHILD')
        ? { deletedAt: null, guardians: { some: { guardianUserId: user.sub } } }
        : { deletedAt: null, userId: user.sub };

      tasks.push(
        db.student.findMany({ where, select: { id: true } }).then(async (students) => {
          if (students.length === 0) return;
          const studentIds = students.map((s) => s.id);
          const [balanceAgg, upcomingTrip] = await Promise.all([
            db.invoice.aggregate({
              _sum: { balance: true },
              where: { studentId: { in: studentIds }, status: { notIn: ['CANCELLED'] } },
            }),
            db.trip.findFirst({
              where: { status: 'APPROVED', tripDate: { gte: new Date() } },
              orderBy: { tripDate: 'asc' },
            }),
          ]);
          const balance = balanceAgg._sum.balance ?? 0;
          if (balance > 0) {
            items.push({
              id: 'own-fee-balance',
              message: `Outstanding fee balance: KES ${balance.toLocaleString()}`,
              href: '/school/finance',
              tone: 'warning',
            });
          }
          if (upcomingTrip) {
            const days = Math.round((upcomingTrip.tripDate.getTime() - Date.now()) / 86_400_000);
            if (days <= 7) {
              items.push({
                id: 'own-upcoming-trip',
                message: `"${upcomingTrip.title}" is coming up in ${days} day${days === 1 ? '' : 's'}`,
                href: '/school/trips',
                tone: 'info',
              });
            }
          }
        }),
      );
    }

    await Promise.all(tasks);

    const dismissals = await db.notificationDismissal.findMany({ where: { userId: user.sub } });
    const dismissedByKey = new Map(dismissals.map((d) => [d.notifKey, d.snapshot]));

    return items.map((item) => ({
      ...item,
      read: dismissedByKey.get(item.id) === item.message,
    }));
  }

  /** Marks one computed item as read. The item's current message is looked up fresh (not trusted from
   * the client) and stored as the dismissal's snapshot, so if the underlying count/content changes
   * later the old dismissal no longer matches and the item reappears as unread automatically. */
  async markRead(user: JwtUserPayload, notifKey: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const current = await this.list(user);
    const item = current.find((i) => i.id === notifKey);
    if (!item) return { ok: true };

    await db.notificationDismissal.upsert({
      where: { userId_notifKey: { userId: user.sub, notifKey } },
      update: { snapshot: item.message, dismissedAt: new Date() },
      create: { userId: user.sub, notifKey, snapshot: item.message },
    });
    return { ok: true };
  }
}
