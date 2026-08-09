import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { PlatformSettingsService } from '../../platform/platform-settings/platform-settings.service';

/** How long a "please reply with your PIN" challenge stays open — if the sender doesn't answer
 * within this window, the next message is treated as a normal command/question again (not a stale
 * PIN guess), so a long-abandoned conversation doesn't awkwardly swallow an unrelated later message. */
const CHALLENGE_WINDOW_MS = 10 * 60_000;

export type PinGateStatus = 'VERIFIED' | 'NEEDS_CHALLENGE' | 'NO_PIN_SET' | 'LOCKED';

interface ResolvedIdentity {
  tenantSchema: string;
  userId: string;
}

/**
 * Extra gate in front of the WhatsApp bot's sensitive replies (fee balance, attendance, exam
 * results, homework, leave status/submission) — separate from the phone-number identification
 * already done by WhatsAppService.resolveUserByPhone(). A user opts in by setting a PIN via the web
 * app (see ProfileController); until they do, the bot won't answer anything sensitive for them at
 * all, since phone-match-only offers no real protection against a lost/shared unlocked phone.
 */
@Injectable()
export class WhatsAppPinService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async checkGate(identity: ResolvedIdentity): Promise<{ status: PinGateStatus; lockedUntil?: Date }> {
    const db = this.tenantPrisma.forSchema(identity.tenantSchema);
    const user = await db.user.findUnique({
      where: { id: identity.userId },
      select: { whatsappPinHash: true, whatsappPinVerifiedAt: true, whatsappPinLockedUntil: true },
    });
    if (!user) return { status: 'NO_PIN_SET' };
    if (user.whatsappPinLockedUntil && user.whatsappPinLockedUntil > new Date()) {
      return { status: 'LOCKED', lockedUntil: user.whatsappPinLockedUntil };
    }
    if (!user.whatsappPinHash) return { status: 'NO_PIN_SET' };

    const settings = await this.platformSettings.get();
    const sessionMs = (settings.whatsappPinSessionHours ?? 24) * 3600_000;
    if (user.whatsappPinVerifiedAt && Date.now() - user.whatsappPinVerifiedAt.getTime() < sessionMs) {
      return { status: 'VERIFIED' };
    }
    return { status: 'NEEDS_CHALLENGE' };
  }

  async startChallenge(identity: ResolvedIdentity): Promise<void> {
    const db = this.tenantPrisma.forSchema(identity.tenantSchema);
    await db.user.update({ where: { id: identity.userId }, data: { whatsappPinChallengeAt: new Date() } });
  }

  /** Called on every inbound message BEFORE it's logged/routed, so the caller can redact the body
   * (never persist a raw PIN digit string in the message log) when this returns true. */
  async isAwaitingPin(identity: ResolvedIdentity): Promise<boolean> {
    const db = this.tenantPrisma.forSchema(identity.tenantSchema);
    const user = await db.user.findUnique({ where: { id: identity.userId }, select: { whatsappPinChallengeAt: true } });
    if (!user?.whatsappPinChallengeAt) return false;
    return Date.now() - user.whatsappPinChallengeAt.getTime() <= CHALLENGE_WINDOW_MS;
  }

  async verifyAttempt(identity: ResolvedIdentity, attempt: string): Promise<{ success: boolean; message: string }> {
    const db = this.tenantPrisma.forSchema(identity.tenantSchema);
    const user = await db.user.findUnique({
      where: { id: identity.userId },
      select: { whatsappPinHash: true, whatsappPinFailedAttempts: true },
    });
    if (!user?.whatsappPinHash) {
      await db.user.update({ where: { id: identity.userId }, data: { whatsappPinChallengeAt: null } });
      return { success: false, message: 'No PIN is set up on your account. Please set one via the web portal (My Profile) first.' };
    }

    const settings = await this.platformSettings.get();
    const maxAttempts = settings.whatsappPinMaxAttempts ?? 5;
    const lockoutMinutes = settings.whatsappPinLockoutMinutes ?? 30;
    const sessionHours = settings.whatsappPinSessionHours ?? 24;

    if (await bcrypt.compare(attempt.trim(), user.whatsappPinHash)) {
      await db.user.update({
        where: { id: identity.userId },
        data: { whatsappPinVerifiedAt: new Date(), whatsappPinChallengeAt: null, whatsappPinFailedAttempts: 0 },
      });
      return { success: true, message: `You're verified for the next ${sessionHours} hours — please resend your question.` };
    }

    const failedAttempts = (user.whatsappPinFailedAttempts ?? 0) + 1;
    if (failedAttempts >= maxAttempts) {
      const lockedUntil = new Date(Date.now() + lockoutMinutes * 60_000);
      await db.user.update({
        where: { id: identity.userId },
        data: { whatsappPinFailedAttempts: 0, whatsappPinLockedUntil: lockedUntil, whatsappPinChallengeAt: null },
      });
      return { success: false, message: `Too many incorrect attempts. Try again in ${lockoutMinutes} minutes, or contact the school office.` };
    }
    await db.user.update({ where: { id: identity.userId }, data: { whatsappPinFailedAttempts: failedAttempts } });
    return { success: false, message: `Incorrect PIN. ${maxAttempts - failedAttempts} attempt(s) left before a temporary lockout.` };
  }
}
