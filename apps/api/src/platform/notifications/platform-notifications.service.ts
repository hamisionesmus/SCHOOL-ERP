import { Injectable } from '@nestjs/common';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { MailboxesService } from '../mailboxes/mailboxes.service';
import { accessibleMailboxKeys } from '../mailboxes/mailbox-keys';
import { JwtUserPayload } from '../../common/decorators/current-user.decorator';

export interface NotificationItem {
  id: string;
  message: string;
  href: string;
  tone: 'info' | 'warning' | 'danger';
  read: boolean;
}

type ComputedItem = Omit<NotificationItem, 'read'>;

/**
 * Platform-side counterpart to apps/api/src/notifications/notifications.service.ts — same computed-
 * feed design (no stored Notification rows, items derived live from data that already exists), gated
 * by PlatformRole instead of tenant permissions. Kept as a separate module/service rather than
 * parameterizing the tenant one since the two audiences (a school's own staff vs the platform
 * operator) are conceptually distinct and unlikely to want the same abstraction long-term.
 */
@Injectable()
export class PlatformNotificationsService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly mailboxes: MailboxesService,
  ) {}

  async list(user: JwtUserPayload): Promise<NotificationItem[]> {
    const items: ComputedItem[] = [];
    const tasks: Promise<void>[] = [];

    tasks.push(
      this.platformPrisma.tenant.count({ where: { status: 'PENDING_PAYMENT', deletedAt: null } }).then((n) => {
        if (n > 0) {
          items.push({
            id: 'schools-pending-payment',
            message: `${n} school${n === 1 ? '' : 's'} awaiting activation payment`,
            href: '/dashboard',
            tone: 'warning',
          });
        }
      }),
    );

    tasks.push(
      this.platformPrisma.tenantCreationRequest
        .count({ where: { consumedAt: null, expiresAt: { lte: new Date(Date.now() + 3_600_000), gt: new Date() } } })
        .then((n) => {
          if (n > 0) {
            items.push({
              id: 'creation-requests-expiring',
              message: `${n} school-creation confirmation${n === 1 ? '' : 's'} about to expire`,
              href: '/dashboard',
              tone: 'warning',
            });
          }
        }),
    );

    tasks.push(
      this.platformPrisma.platformPaymentProof.count({ where: { status: 'PENDING_REVIEW' } }).then((n) => {
        if (n > 0) {
          items.push({
            id: 'payment-proofs-pending',
            message: `${n} payment proof${n === 1 ? '' : 's'} awaiting review`,
            href: '/dashboard',
            tone: 'info',
          });
        }
      }),
    );

    tasks.push(
      this.platformSettings.get().then(async (settings) => {
        const now = new Date();
        const renewalDeadline = new Date(now.getTime() + settings.renewalReminderDaysBefore * 86_400_000);
        const n = await this.platformPrisma.tenant.count({
          where: { isDemo: false, status: 'ACTIVE', currentPeriodEnd: { lte: renewalDeadline, gt: now } },
        });
        if (n > 0) {
          items.push({
            id: 'renewals-approaching',
            message: `${n} school${n === 1 ? '' : 's'} renewing soon`,
            href: '/dashboard',
            tone: 'info',
          });
        }
      }),
    );

    tasks.push(
      this.platformPrisma.platformTicketEscalation
        .count({
          where:
            user.role === 'SUB_ADMIN'
              ? { status: { not: 'RESOLVED' }, assignedToId: user.sub }
              : { status: { not: 'RESOLVED' } },
        })
        .then((n) => {
          if (n > 0) {
            items.push({
              id: 'tickets-open',
              message:
                user.role === 'SUB_ADMIN'
                  ? `${n} ticket${n === 1 ? '' : 's'} assigned to you`
                  : `${n} escalated ticket${n === 1 ? '' : 's'} need attention`,
              href: '/dashboard/tickets',
              tone: 'danger',
            });
          }
        }),
    );

    tasks.push(
      this.mailboxes.unreadCount(accessibleMailboxKeys(user.role)).then((n) => {
        if (n > 0) {
          items.push({
            id: 'inbox-unread',
            message: `${n} unread email${n === 1 ? '' : 's'} in your inbox`,
            href: '/dashboard/inbox',
            tone: 'info',
          });
        }
      }),
    );

    tasks.push(
      this.platformPrisma.hamzoneMarketingLead
        .count({ where: { followUpAt: { lte: new Date() }, status: { notIn: ['CONVERTED', 'LOST'] } } })
        .then((n) => {
          if (n > 0) {
            items.push({
              id: 'crm-leads-followup-due',
              message: `${n} lead${n === 1 ? '' : 's'} due for follow-up`,
              href: '/dashboard/crm/leads',
              tone: 'warning',
            });
          }
        }),
    );

    tasks.push(
      this.platformPrisma.hamzoneStaffTask
        .count({ where: { assignedToUserId: user.sub, status: { not: 'DONE' }, dueDate: { lte: new Date() } } })
        .then((n) => {
          if (n > 0) {
            items.push({
              id: 'crm-tasks-due-today',
              message: `${n} task${n === 1 ? '' : 's'} due for you`,
              href: '/dashboard/crm',
              tone: 'warning',
            });
          }
        }),
    );

    tasks.push(
      // HamzoneInvoiceStatus.OVERDUE is never actually set by any write path — computed live here
      // instead of trusting the stored enum value, same reasoning as the tenant-side
      // "invoices-overdue" item in apps/api/src/notifications/notifications.service.ts.
      this.platformPrisma.hamzoneInvoice.count({ where: { status: 'PENDING', dueDate: { lt: new Date() } } }).then((n) => {
        if (n > 0) {
          items.push({
            id: 'crm-invoices-overdue',
            message: `${n} client invoice${n === 1 ? '' : 's'} overdue`,
            href: '/dashboard/crm/invoices',
            tone: 'danger',
          });
        }
      }),
    );

    await Promise.all(tasks);

    const dismissals = await this.platformPrisma.platformNotificationDismissal.findMany({
      where: { userId: user.sub },
    });
    const dismissedByKey = new Map(dismissals.map((d) => [d.notifKey, d.snapshot]));

    return items.map((item) => ({
      ...item,
      read: dismissedByKey.get(item.id) === item.message,
    }));
  }

  /** Same content-keyed dismissal semantics as the tenant-side service — see its own doc comment. */
  async markRead(user: JwtUserPayload, notifKey: string) {
    const current = await this.list(user);
    const item = current.find((i) => i.id === notifKey);
    if (!item) return { ok: true };

    await this.platformPrisma.platformNotificationDismissal.upsert({
      where: { userId_notifKey: { userId: user.sub, notifKey } },
      update: { snapshot: item.message, dismissedAt: new Date() },
      create: { userId: user.sub, notifKey, snapshot: item.message },
    });
    return { ok: true };
  }
}
