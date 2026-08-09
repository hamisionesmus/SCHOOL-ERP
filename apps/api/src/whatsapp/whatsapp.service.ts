import { Inject, Injectable, Logger } from '@nestjs/common';
import { PlatformPrismaService } from '../common/prisma/platform-prisma.service';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { HrService } from '../hr/hr.service';
import { WHATSAPP_PROVIDER, WhatsAppProvider } from './whatsapp-provider.interface';

interface ResolvedSender {
  tenantId: string;
  tenantSchema: string;
  user: { id: string; fullName: string; email: string };
}

function normalizeKenyanPhone(input: string): string {
  const digits = input.replace(/[^\d]/g, '');
  if (/^254(7|1)\d{8}$/.test(digits)) return digits;
  if (/^0(7|1)\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^(7|1)\d{8}$/.test(digits)) return `254${digits}`;
  return digits;
}

const HELP_TEXT =
  'Hi! You can submit a leave request by texting:\n\n' +
  'LEAVE <type> <start YYYY-MM-DD> <end YYYY-MM-DD> [reason]\n\n' +
  'Example:\nLEAVE Annual 2026-09-01 2026-09-05 Family trip';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * WhatsApp is just another interface into the same P2Less backend — a message received here calls
 * the exact same service methods (HrService.createLeaveRequest(), same workflow engine, same
 * database) that the web app's HTTP controllers call, not a parallel implementation. Phase 1 is
 * intentionally scoped to real send/receive infrastructure plus one deterministic, structured command
 * (LEAVE ...) proving that principle end-to-end; free-text natural-language parsing via an AI/NLU
 * layer is a distinct, larger future phase, not attempted here.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger('WhatsApp');

  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsAppProvider,
    private readonly hrService: HrService,
  ) {}

  /** Super-Admin-facing message log — most recent first, same `take: 100` convention as
   * CommunicationsService.listMessages(). Includes the resolved school's name where known, since a
   * bare tenantId isn't useful to look at directly. */
  async listMessages() {
    const messages = await this.platformPrisma.platformWhatsAppMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { tenant: { select: { name: true } } },
    });
    return messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      waId: m.waId,
      schoolName: m.tenant?.name ?? null,
      body: m.body,
      status: m.status,
      createdAt: m.createdAt,
    }));
  }

  async sendText(to: string, body: string, context?: { tenantId?: string; resolvedUserId?: string }) {
    const result = await this.provider.send(to, body);
    await this.platformPrisma.platformWhatsAppMessage
      .create({
        data: {
          direction: 'OUT',
          waId: normalizeKenyanPhone(to),
          tenantId: context?.tenantId,
          resolvedUserId: context?.resolvedUserId,
          body,
          messageId: result.providerMessageId,
          status: result.success ? 'sent' : 'failed',
        },
      })
      .catch((err) => this.logger.error(`Failed to log outbound WhatsApp message: ${err instanceof Error ? err.message : String(err)}`));
    return result;
  }

  /** Fan out across every provisioned tenant schema looking for a User whose phone matches — a
   * WhatsApp webhook only carries a bare phone number, never a tenant slug, and User.phone has no
   * platform-wide uniqueness guarantee (unlike email — see UserDirectoryEntry), so this is a
   * best-effort linear scan rather than an indexed lookup. Acceptable at this platform's current
   * scale (dozens of schools, not thousands); revisit with a dedicated phone directory if it grows. */
  async resolveUserByPhone(waId: string): Promise<ResolvedSender | null> {
    const normalized = normalizeKenyanPhone(waId);
    const tenants = await this.platformPrisma.tenant.findMany({
      where: { deletedAt: null },
      select: { id: true, schemaName: true },
    });
    for (const tenant of tenants) {
      const db = this.tenantPrisma.forSchema(tenant.schemaName);
      const candidates = await db.user.findMany({
        where: { phone: { not: null }, isActive: true, deletedAt: null },
        select: { id: true, fullName: true, email: true, phone: true },
      });
      const match = candidates.find((c) => c.phone && normalizeKenyanPhone(c.phone) === normalized);
      if (match) {
        return { tenantId: tenant.id, tenantSchema: tenant.schemaName, user: { id: match.id, fullName: match.fullName, email: match.email } };
      }
    }
    return null;
  }

  /** Entry point called by WhatsAppController on every inbound webhook message. */
  async handleInboundMessage(waId: string, text: string, messageId: string) {
    const normalized = normalizeKenyanPhone(waId);

    // Meta retries webhook delivery on timeout — dedupe by its own message id so a retry never
    // double-processes the same command (e.g. submitting the same leave request twice).
    const existing = await this.platformPrisma.platformWhatsAppMessage.findUnique({ where: { messageId } });
    if (existing) return;

    const resolved = await this.resolveUserByPhone(normalized);

    await this.platformPrisma.platformWhatsAppMessage
      .create({
        data: {
          direction: 'IN',
          waId: normalized,
          tenantId: resolved?.tenantId,
          resolvedUserId: resolved?.user.id,
          body: text,
          messageId,
        },
      })
      .catch((err) => this.logger.error(`Failed to log inbound WhatsApp message: ${err instanceof Error ? err.message : String(err)}`));

    if (!resolved) {
      await this.sendText(waId, "We couldn't find an account registered with this WhatsApp number. Please ask your school administrator to add your phone number to your profile.");
      return;
    }

    await this.routeCommand(waId, text, resolved);
  }

  private async routeCommand(waId: string, text: string, resolved: ResolvedSender) {
    const parts = text.trim().split(/\s+/);
    const command = parts[0]?.toUpperCase();

    if (command === 'LEAVE') {
      await this.handleLeaveCommand(waId, parts.slice(1), resolved);
      return;
    }

    await this.sendText(waId, HELP_TEXT, { tenantId: resolved.tenantId, resolvedUserId: resolved.user.id });
  }

  private async handleLeaveCommand(waId: string, args: string[], resolved: ResolvedSender) {
    const [leaveType, startDate, endDate, ...reasonParts] = args;
    const replyContext = { tenantId: resolved.tenantId, resolvedUserId: resolved.user.id };

    if (!leaveType || !startDate || !endDate || !DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      await this.sendText(
        waId,
        'Sorry, that format wasn\'t quite right.\n\n' + HELP_TEXT,
        replyContext,
      );
      return;
    }

    const user: JwtUserPayload = {
      sub: resolved.user.id,
      realm: 'tenant',
      fullName: resolved.user.fullName,
      email: resolved.user.email,
      tenantSchema: resolved.tenantSchema,
    };

    try {
      await this.hrService.createLeaveRequest(user, {
        leaveType,
        startDate,
        endDate,
        reason: reasonParts.length > 0 ? reasonParts.join(' ') : undefined,
      });
      await this.sendText(
        waId,
        `Your ${leaveType} leave request (${startDate} to ${endDate}) has been submitted for review. We'll notify you once it's decided.`,
        replyContext,
      );
    } catch (err) {
      this.logger.error(`WhatsApp leave request failed for ${resolved.user.email}: ${err instanceof Error ? err.message : String(err)}`);
      await this.sendText(waId, "Sorry, we couldn't submit that leave request. Please try again or use the web portal.", replyContext);
    }
  }
}
