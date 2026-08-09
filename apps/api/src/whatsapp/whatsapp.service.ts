import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PlatformPrismaService } from '../common/prisma/platform-prisma.service';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { HrService } from '../hr/hr.service';
import { WHATSAPP_PROVIDER, WhatsAppProvider } from './whatsapp-provider.interface';
import { WhatsAppBaileysService } from './baileys/whatsapp-baileys.service';
import { WhatsAppClaudeProvider } from './assistant/whatsapp-claude.provider';
import { WhatsAppPinService } from './pin/whatsapp-pin.service';

interface ResolvedSender {
  tenantId: string;
  tenantSchema: string;
  user: { id: string; fullName: string; email: string; roles: string[]; permissions: string[] };
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
  'Example:\nLEAVE Annual 2026-09-01 2026-09-05 Family trip\n\n' +
  "Or just ask me a question in your own words — e.g. \"what's my fee balance\" or \"was my child at school today\".";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * WhatsApp is just another interface into the same P2Less backend. LEAVE stays a deterministic,
 * structured command (calls HrService.createLeaveRequest() directly, same workflow engine, same
 * database as the web app); everything else free-text is handed to WhatsAppClaudeProvider, which can
 * only answer via a fixed set of read-only, sender-scoped tools (see
 * WhatsAppAssistantToolsService) — it never gets raw database access.
 */
@Injectable()
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger('WhatsApp');

  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsAppProvider,
    private readonly hrService: HrService,
    private readonly baileys: WhatsAppBaileysService,
    private readonly assistant: WhatsAppClaudeProvider,
    private readonly pinService: WhatsAppPinService,
  ) {}

  /** Inbound messages arriving over the QR-linked device (Baileys) reach this exact same
   * handleInboundMessage() the Meta Cloud API webhook already calls — one shared command router
   * regardless of which connection method is actually active. Subscribed here rather than the
   * Baileys service calling this directly, to avoid a circular constructor-injection dependency
   * (WhatsAppBaileysService is itself a candidate for the WHATSAPP_PROVIDER token this class also
   * depends on). */
  onModuleInit() {
    this.baileys.events.on('message', ({ waId, text, messageId }: { waId: string; text: string; messageId: string }) => {
      this.handleInboundMessage(waId, text, messageId).catch((err) =>
        this.logger.error(`Failed to handle inbound Baileys message: ${err instanceof Error ? err.message : String(err)}`),
      );
    });
  }

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
        // Flatten roles/permissions the same way AuthService does at login — the AI assistant's tool
        // calls (Finance/Attendance/Exams/Homework services) all branch on user.permissions, so a
        // WhatsApp-resolved sender needs the same shape a real JWT would carry, not just an id.
        const userRoles = await db.userRole.findMany({
          where: { userId: match.id },
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        });
        const roles = userRoles.map((ur) => ur.role.name);
        const permissions = [...new Set(userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code)))];
        return {
          tenantId: tenant.id,
          tenantSchema: tenant.schemaName,
          user: { id: match.id, fullName: match.fullName, email: match.email, roles, permissions },
        };
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

    // Check whether this message is expected to be a PIN attempt BEFORE logging it, so a raw PIN
    // digit string never ends up sitting in the Super-Admin-visible message log.
    const identity = resolved ? { tenantSchema: resolved.tenantSchema, userId: resolved.user.id } : null;
    const awaitingPin = identity ? await this.pinService.isAwaitingPin(identity) : false;

    await this.platformPrisma.platformWhatsAppMessage
      .create({
        data: {
          direction: 'IN',
          waId: normalized,
          tenantId: resolved?.tenantId,
          resolvedUserId: resolved?.user.id,
          body: awaitingPin ? '[PIN attempt]' : text,
          messageId,
        },
      })
      .catch((err) => this.logger.error(`Failed to log inbound WhatsApp message: ${err instanceof Error ? err.message : String(err)}`));

    if (!resolved || !identity) {
      await this.sendText(waId, "We couldn't find an account registered with this WhatsApp number. Please ask your school administrator to add your phone number to your profile.");
      return;
    }

    const replyContext = { tenantId: resolved.tenantId, resolvedUserId: resolved.user.id };
    if (awaitingPin) {
      const result = await this.pinService.verifyAttempt(identity, text);
      await this.sendText(waId, result.message, replyContext);
      return;
    }

    await this.routeCommand(waId, text, resolved);
  }

  private async routeCommand(waId: string, text: string, resolved: ResolvedSender) {
    const parts = text.trim().split(/\s+/);
    const command = parts[0]?.toUpperCase();
    const replyContext = { tenantId: resolved.tenantId, resolvedUserId: resolved.user.id };
    const identity = { tenantSchema: resolved.tenantSchema, userId: resolved.user.id };

    const gate = await this.pinService.checkGate(identity);
    if (gate.status === 'LOCKED') {
      const minutes = gate.lockedUntil ? Math.max(1, Math.ceil((gate.lockedUntil.getTime() - Date.now()) / 60000)) : undefined;
      await this.sendText(waId, `Too many incorrect PIN attempts. Please try again${minutes ? ` in about ${minutes} minute(s)` : ' shortly'}.`, replyContext);
      return;
    }
    if (gate.status === 'NO_PIN_SET') {
      await this.sendText(
        waId,
        "For your security, set up a WhatsApp PIN first — log into the web portal, open My Profile, and set one there. Come back once it's set and I'll help.",
        replyContext,
      );
      return;
    }
    if (gate.status === 'NEEDS_CHALLENGE') {
      await this.pinService.startChallenge(identity);
      await this.sendText(waId, 'For your security, please reply with your WhatsApp PIN to continue.', replyContext);
      return;
    }

    if (command === 'LEAVE') {
      await this.handleLeaveCommand(waId, parts.slice(1), resolved);
      return;
    }

    // Everything else goes to the AI assistant — it decides for itself whether the message is
    // answerable via one of its read-only tools (fees/attendance/exams/homework/leave) or is out of
    // scope, and replies accordingly (falls back to HELP_TEXT-style guidance when unconfigured).
    const user: JwtUserPayload = {
      sub: resolved.user.id,
      realm: 'tenant',
      fullName: resolved.user.fullName,
      email: resolved.user.email,
      tenantSchema: resolved.tenantSchema,
      roles: resolved.user.roles,
      permissions: resolved.user.permissions,
    };
    const tenant = await this.platformPrisma.tenant.findUnique({ where: { id: resolved.tenantId }, select: { name: true } });
    try {
      const reply = await this.assistant.answer(user, tenant?.name ?? 'your school', text);
      await this.sendText(waId, reply, replyContext);
    } catch (err) {
      this.logger.error(`AI assistant failed for ${resolved.user.email}: ${err instanceof Error ? err.message : String(err)}`);
      await this.sendText(waId, "Sorry, I couldn't process that.\n\n" + HELP_TEXT, replyContext);
    }
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
      roles: resolved.user.roles,
      permissions: resolved.user.permissions,
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
