import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { CommunicationsService } from '../../communications/communications.service';
import { TicketsGateway } from '../../tickets/tickets.gateway';

const ESCALATION_INCLUDE = {
  tenant: { select: { id: true, name: true, slug: true } },
  assignedTo: { select: { id: true, fullName: true } },
} as const;

/**
 * Platform-side view of escalated tickets. The escalation row here is a denormalized summary —
 * the real conversation (description + comment thread) lives in the tenant's own schema and is
 * fetched/written live via TenantPrismaService.forSchema(), same cross-schema direction already
 * proven by AuditLogAccessService.
 */
@Injectable()
export class PlatformTicketsService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly notifier: PlatformNotifierService,
    private readonly communications: CommunicationsService,
    private readonly ticketsGateway: TicketsGateway,
  ) {}

  list() {
    return this.platformPrisma.platformTicketEscalation.findMany({
      include: ESCALATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findEscalation(id: string) {
    const escalation = await this.platformPrisma.platformTicketEscalation.findUnique({
      where: { id },
      include: ESCALATION_INCLUDE,
    });
    if (!escalation) throw new NotFoundException('Escalation not found');
    return escalation;
  }

  async findOne(id: string) {
    const escalation = await this.findEscalation(id);
    const tenant = await this.platformPrisma.tenant.findUnique({ where: { id: escalation.tenantId } });
    if (!tenant) throw new NotFoundException('School not found');

    const db = this.tenantPrisma.forSchema(tenant.schemaName);
    const ticket = await db.ticket.findUnique({
      where: { id: escalation.ticketId },
      include: {
        submittedBy: { select: { id: true, fullName: true, email: true } },
        comments: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, fullName: true } } } },
      },
    });

    return { escalation, ticket };
  }

  async addComment(user: JwtUserPayload, id: string, body: string) {
    const escalation = await this.findEscalation(id);
    const tenant = await this.platformPrisma.tenant.findUnique({ where: { id: escalation.tenantId } });
    if (!tenant) throw new NotFoundException('School not found');

    const db = this.tenantPrisma.forSchema(tenant.schemaName);
    const comment = await db.ticketComment.create({
      data: {
        ticketId: escalation.ticketId,
        isPlatformReply: true,
        platformAuthorName: `Platform Support (${user.fullName})`,
        body,
      },
    });
    this.ticketsGateway.emitComment(escalation.ticketId, {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      isPlatformReply: comment.isPlatformReply,
      platformAuthorName: comment.platformAuthorName,
      author: null,
    });

    const ticket = await db.ticket.findUnique({ where: { id: escalation.ticketId } });
    if (ticket) {
      await this.communications.sendToUserId(
        tenant.schemaName,
        ticket.submittedByUserId,
        `School ERP: platform support replied to your ticket "${ticket.subject}".`,
      );
    }

    return comment;
  }

  async assign(user: JwtUserPayload, id: string, assignedToId: string) {
    const escalation = await this.findEscalation(id);
    if (escalation.status === 'RESOLVED') throw new BadRequestException('This ticket is already resolved');

    const assignee = await this.platformPrisma.platformUser.findUnique({ where: { id: assignedToId } });
    if (!assignee || assignee.deletedAt) throw new NotFoundException('Admin not found');

    const updated = await this.platformPrisma.platformTicketEscalation.update({
      where: { id },
      data: { assignedToId, status: 'ASSIGNED' },
      include: ESCALATION_INCLUDE,
    });

    await this.notifier.notify('TICKET_ASSIGNED', {
      to: { email: assignee.email, phone: assignee.phone },
      vars: {
        schoolName: updated.tenant.name,
        subject: updated.subject,
        priority: updated.priority,
        dashboardUrl: `/dashboard/tickets/${id}`,
      },
    });
    this.ticketsGateway.emitStatusChange(escalation.ticketId, 'ASSIGNED');

    return updated;
  }

  async resolve(user: JwtUserPayload, id: string, resolutionNote?: string) {
    const escalation = await this.findEscalation(id);
    if (escalation.status === 'RESOLVED') throw new BadRequestException('This ticket is already resolved');
    if (user.role !== 'SUPER_ADMIN' && escalation.assignedToId !== user.sub) {
      throw new ForbiddenException('Only the Super Admin or the assigned Sub-Admin can resolve this ticket');
    }

    const tenant = await this.platformPrisma.tenant.findUnique({ where: { id: escalation.tenantId } });
    if (!tenant) throw new NotFoundException('School not found');

    const [updated] = await Promise.all([
      this.platformPrisma.platformTicketEscalation.update({
        where: { id },
        data: { status: 'RESOLVED', resolutionNote, resolvedAt: new Date() },
        include: ESCALATION_INCLUDE,
      }),
      this.tenantPrisma.forSchema(tenant.schemaName).ticket.update({
        where: { id: escalation.ticketId },
        data: { status: 'RESOLVED', resolutionNote, resolvedAt: new Date() },
      }),
    ]);

    const ticket = await this.tenantPrisma.forSchema(tenant.schemaName).ticket.findUnique({
      where: { id: escalation.ticketId },
    });
    if (ticket) {
      await this.communications.sendToUserId(
        tenant.schemaName,
        ticket.submittedByUserId,
        `School ERP: your ticket "${ticket.subject}" has been resolved.`,
      );
    }
    this.ticketsGateway.emitStatusChange(escalation.ticketId, 'RESOLVED');

    return updated;
  }
}
