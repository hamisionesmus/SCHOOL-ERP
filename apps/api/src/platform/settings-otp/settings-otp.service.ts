import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma } from '../../../generated/platform-client';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { UpdatePlatformSettingsDto } from '../platform-settings/dto/update-platform-settings.dto';

const CODE_TTL_MS = 15 * 60 * 1000;

export type SettingsChangeScope = 'SETTINGS' | 'TEMPLATES' | 'PROFILE' | 'ADMINS';

const PAYMENT_FIELDS = ['bankName', 'bankAccountName', 'bankAccountNumber', 'paybillNumber', 'paybillAccountName', 'stkEnabled', 'bankTransferEnabled', 'paybillEnabled'];
const NOTIFICATION_FIELDS = ['smsEnabled', 'emailEnabled', 'demoReminderDaysBefore', 'renewalReminderDaysBefore'];
const API_CONFIG_FIELDS = ['mpesaEnv', 'mpesaConsumerKey', 'mpesaConsumerSecret', 'mpesaShortcode', 'mpesaPasskey', 'mpesaCallbackUrl', 'resendApiKey', 'resendFromAddress', 'advantaApiKey', 'advantaPartnerId', 'advantaSenderId'];
const BRANDING_FIELDS = [
  'systemName',
  'loginTagline',
  'loginSubtitle',
  'loginLogoUrl',
  'faviconUrl',
  'loginHeading',
  'loginHelperText',
  'loginFooterText',
  'builtByText',
];

/** Says exactly what's being requested, in the OTP notification the requester receives — so a
 * generic "confirm code {{code}}" never leaves the recipient guessing what they're approving.
 * Never names a role/tier (see docs/RBAC.md); only what's being changed and, for admin invites, by
 * whom the invitee will be — as "an admin", not the specific rank. */
function describeOperation(scope: SettingsChangeScope, changes: object): string {
  const keys = Object.keys(changes);
  switch (scope) {
    case 'SETTINGS': {
      if (keys.some((k) => PAYMENT_FIELDS.includes(k))) return 'update Payment Details';
      if (keys.some((k) => NOTIFICATION_FIELDS.includes(k))) return 'update Notification settings';
      if (keys.some((k) => API_CONFIG_FIELDS.includes(k))) return 'update API & Payment Config';
      if (keys.some((k) => BRANDING_FIELDS.includes(k))) return 'update Branding';
      return 'update Platform Settings';
    }
    case 'TEMPLATES': {
      const key = (changes as { key?: string }).key;
      return key ? `edit the "${key}" message template` : 'edit a message template';
    }
    case 'PROFILE':
      return 'update your profile';
    case 'ADMINS': {
      const name = (changes as { fullName?: string }).fullName;
      return name ? `invite ${name} as a new admin` : 'invite a new admin';
    }
    default:
      return 'change platform settings';
  }
}

/**
 * Generalizes the two-code tenant-creation gate (see TenantsService.requestCreate/confirmCreate)
 * to platform config changes: propose an edit, a 6-digit code goes to the requester's own
 * email/phone, and only confirming it applies the change — so a compromised or unattended session
 * can't silently alter platform-wide payment config, messaging, someone's own profile, or the
 * admin roster. `SETTINGS`/`TEMPLATES`/`PROFILE` are applied automatically by `confirm()`;
 * `ADMINS` (creating a new Sub-Admin — see PlatformAdminsService) needs bespoke side effects
 * (generating a temp password, sending a welcome message) that don't fit the generic "upsert these
 * fields" pattern, so callers for that scope use `verifyAndConsume()` instead and apply the change
 * themselves.
 */
@Injectable()
export class SettingsOtpService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly notifier: PlatformNotifierService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async request(requestedById: string, scope: SettingsChangeScope, changes: object) {
    const requester = await this.platformPrisma.platformUser.findUnique({ where: { id: requestedById } });
    if (!requester) throw new UnauthorizedException();

    const code = String(randomInt(100_000, 1_000_000));
    const request = await this.platformPrisma.platformSettingsChangeRequest.create({
      data: {
        requestedById,
        scope,
        changes: changes as Prisma.InputJsonValue,
        code,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    await this.notifier.notify('SETTINGS_OTP', {
      to: { email: requester.email, phone: requester.phone },
      vars: { code, operation: describeOperation(scope, changes), requestedByName: requester.fullName },
    });

    const emailConfigured = await this.platformSettings.isEmailConfigured();
    return { requestId: request.id, expiresAt: request.expiresAt, devCode: emailConfigured ? undefined : code };
  }

  /** Validates the code, marks the request consumed, and returns what was proposed — without
   * applying it. Used directly by scopes whose "apply" step needs bespoke logic (see class
   * comment); `confirm()` below calls this too for the scopes it knows how to apply itself. */
  async verifyAndConsume(requestId: string, code: string) {
    const request = await this.platformPrisma.platformSettingsChangeRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Change request not found');
    if (request.consumedAt) throw new BadRequestException('This request has already been used');
    if (request.expiresAt < new Date()) throw new BadRequestException('This code has expired — start over');
    if (request.code !== code) throw new BadRequestException('Incorrect confirmation code');

    await this.platformPrisma.platformSettingsChangeRequest.update({
      where: { id: requestId },
      data: { consumedAt: new Date() },
    });

    return { scope: request.scope as SettingsChangeScope, requestedById: request.requestedById, changes: request.changes as Record<string, unknown> };
  }

  async confirm(requestId: string, code: string) {
    const { scope, requestedById, changes } = await this.verifyAndConsume(requestId, code);

    if (scope === 'SETTINGS') {
      await this.platformSettings.update(changes as UpdatePlatformSettingsDto);
      // Never echo raw secrets back over the wire, even right after the client that just set them
      // sent them in — same masking as the plain GET (see PlatformSettingsService.getMaskedForClient).
      return this.platformSettings.getMaskedForClient();
    }
    if (scope === 'TEMPLATES') {
      const { key, ...fields } = changes as { key: string } & Record<string, unknown>;
      return this.platformPrisma.platformMessageTemplate.upsert({
        where: { key },
        update: fields,
        create: { key, ...fields },
      });
    }
    if (scope === 'PROFILE') {
      return this.platformPrisma.platformUser.update({
        where: { id: requestedById },
        data: changes,
        select: { id: true, email: true, phone: true, fullName: true, role: true },
      });
    }
    throw new BadRequestException('This change scope must be confirmed through its own endpoint');
  }
}
