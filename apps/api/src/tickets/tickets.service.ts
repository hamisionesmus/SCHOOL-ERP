import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { PlatformPrismaService } from '../common/prisma/platform-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CommunicationsService } from '../communications/communications.service';
import { PlatformNotifierService } from '../platform/messaging/platform-notifier.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketCommentDto } from './dto/create-comment.dto';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';
import { EscalateTicketDto } from './dto/escalate-ticket.dto';

const TICKET_INCLUDE = {
  submittedBy: { select: { id: true, fullName: true, email: true } },
  handledBy: { select: { id: true, fullName: true } },
} as const;

/**
 * Ticket content lives entirely in the tenant's own schema. Escalation only creates a lightweight
 * PlatformTicketEscalation row in the platform schema (see PlatformTicketsService) — this service
 * is the one that reaches across into the platform schema to create/notify on escalation, mirroring
 * AuditLogAccessService's cross-schema direction in reverse.
 */
@Injectable()
export class TicketsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly platformPrisma: PlatformPrismaService,
    private readonly communications: CommunicationsService,
    private readonly platformNotifier: PlatformNotifierService,
  ) {}

  async create(user: JwtUserPayload, dto: CreateTicketDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const ticket = await db.ticket.create({
      data: {
        submittedByUserId: user.sub,
        subject: dto.subject,
        description: dto.description,
        category: dto.category,
        priority: dto.priority ?? 'NORMAL',
      },
      include: TICKET_INCLUDE,
    });

    if (ticket.priority === 'HIGH' || ticket.priority === 'URGENT') {
      const admins = await db.user.findMany({
        where: { userRoles: { some: { role: { name: 'School Administrator' } } } },
        select: { id: true },
      });
      await Promise.all(
        admins.map((a) =>
          this.communications.sendToUserId(
            user.tenantSchema!,
            a.id,
            `School ERP: new ${ticket.priority} priority ticket — "${ticket.subject}". Please review.`,
          ),
        ),
      );
    }

    return ticket;
  }

  async list(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];

    if (perms.includes('TICKET:MANAGE')) {
      return db.ticket.findMany({ include: TICKET_INCLUDE, orderBy: { createdAt: 'desc' } });
    }
    return db.ticket.findMany({
      where: { submittedByUserId: user.sub },
      include: TICKET_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findAccessible(user: JwtUserPayload, id: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];
    const ticket = await db.ticket.findUnique({
      where: { id },
      include: {
        ...TICKET_INCLUDE,
        comments: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, fullName: true } } } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.submittedByUserId !== user.sub && !perms.includes('TICKET:MANAGE')) {
      throw new ForbiddenException('You do not have access to this ticket');
    }
    return ticket;
  }

  findOne(user: JwtUserPayload, id: string) {
    return this.findAccessible(user, id);
  }

  async addComment(user: JwtUserPayload, id: string, dto: CreateTicketCommentDto) {
    await this.findAccessible(user, id);
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.ticketComment.create({
      data: { ticketId: id, authorUserId: user.sub, body: dto.body },
      include: { author: { select: { id: true, fullName: true } } },
    });
  }

  async resolve(user: JwtUserPayload, id: string, dto: ResolveTicketDto) {
    if (!(user.permissions ?? []).includes('TICKET:MANAGE')) throw new ForbiddenException();
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const ticket = await db.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status !== 'OPEN' && ticket.status !== 'ESCALATED') {
      throw new BadRequestException('This ticket is already resolved');
    }

    const resolved = await db.ticket.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        handledByUserId: user.sub,
        resolutionNote: dto.resolutionNote,
        resolvedAt: new Date(),
      },
      include: TICKET_INCLUDE,
    });

    await this.communications.sendToUserId(
      user.tenantSchema!,
      ticket.submittedByUserId,
      `School ERP: your ticket "${ticket.subject}" has been resolved.`,
    );

    return resolved;
  }

  async escalate(user: JwtUserPayload, id: string, dto: EscalateTicketDto) {
    if (!(user.permissions ?? []).includes('TICKET:MANAGE')) throw new ForbiddenException();
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const ticket = await db.ticket.findUnique({ where: { id }, include: TICKET_INCLUDE });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status !== 'OPEN') throw new BadRequestException('Only an open ticket can be escalated');

    const tenant = await this.platformPrisma.tenant.findFirst({ where: { schemaName: user.tenantSchema! } });
    if (!tenant) throw new NotFoundException('School record not found on the platform');

    const [updated] = await Promise.all([
      db.ticket.update({
        where: { id },
        data: { status: 'ESCALATED', handledByUserId: user.sub, escalatedAt: new Date(), escalationReason: dto.escalationReason },
        include: TICKET_INCLUDE,
      }),
      this.platformPrisma.platformTicketEscalation.create({
        data: {
          tenantId: tenant.id,
          ticketId: ticket.id,
          subject: ticket.subject,
          category: ticket.category,
          priority: ticket.priority,
          submitterName: ticket.submittedBy.fullName,
          escalationReason: dto.escalationReason,
        },
      }),
    ]);

    const superAdmins = await this.platformPrisma.platformUser.findMany({
      where: { role: 'SUPER_ADMIN', deletedAt: null },
    });
    await Promise.all(
      superAdmins.map((admin) =>
        this.platformNotifier.notify('TICKET_ESCALATED', {
          to: { email: admin.email, phone: admin.phone },
          vars: {
            schoolName: tenant.name,
            subject: ticket.subject,
            priority: ticket.priority,
            escalationReason: dto.escalationReason,
            dashboardUrl: '/dashboard/tickets',
          },
        }),
      ),
    );

    return updated;
  }
}
