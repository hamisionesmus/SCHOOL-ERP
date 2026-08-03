import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';

const SETTINGS_ID = 'platform';
const DEFAULT_SYSTEM_NAME = 'School ERP';
const DEFAULT_LOGIN_SUBTITLE = 'Kenyan CBC · PP1 — Grade 9';

/** Fields whose value must never be echoed back once set — only a "configured" boolean and a short
 * preview of the last few characters, same principle as passwords never being displayed again (see
 * BillingService.resetSchoolAdminPassword's doc comment). Everything else on PlatformSettings is
 * either not exploitable alone (shortcode, partner id, sender id, callback URL) or already public. */
const SECRET_FIELDS = ['mpesaConsumerSecret', 'mpesaPasskey', 'resendApiKey', 'advantaApiKey'] as const;

function maskSecret(value: string | null): { set: boolean; preview: string | null } {
  if (!value) return { set: false, preview: null };
  return { set: true, preview: value.length > 4 ? `••••${value.slice(-4)}` : '••••' };
}

/** Singleton row (fixed id) — the platform's own bank/paybill details for receiving activation
 * payments, feature toggles, reminder windows, and (as of this feature) DB-backed third-party API
 * credentials (M-Pesa/Resend/Advanta) plus login-page branding. Distinct from a school's own
 * Tenant.bankName/mpesaPaybill (fee-collection config for that school's parents) — this is where a
 * SCHOOL pays School ERP, not where a parent pays a school. */
@Injectable()
export class PlatformSettingsService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly config: ConfigService,
  ) {}

  async get() {
    return this.platformPrisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });
  }

  async update(dto: UpdatePlatformSettingsDto) {
    return this.platformPrisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      update: dto,
      create: { id: SETTINGS_ID, ...dto },
    });
  }

  /** What the authenticated Settings screen sees: everything in full except SECRET_FIELDS, which
   * come back masked (never the raw value) once set. */
  async getMaskedForClient() {
    const s = await this.get();
    const masked: Record<string, unknown> = { ...s };
    for (const field of SECRET_FIELDS) {
      masked[field] = maskSecret(s[field] as string | null);
    }
    return masked;
  }

  /** Public-safe subset — only the fields a school needs to see to pay, plus which methods are
   * currently enabled so the activation page can hide any the Super Admin has turned off. */
  async getPublicPaymentDetails() {
    const s = await this.get();
    return {
      bankName: s.bankName,
      bankAccountName: s.bankAccountName,
      bankAccountNumber: s.bankAccountNumber,
      paybillNumber: s.paybillNumber,
      paybillAccountName: s.paybillAccountName,
      stkEnabled: s.stkEnabled,
      bankTransferEnabled: s.bankTransferEnabled,
      paybillEnabled: s.paybillEnabled,
    };
  }

  /** Login-page branding — platform-wide only, never per-school (each school's own branding lives on
   * Tenant.logoUrl/primaryColor etc. and is untouched by this). */
  async getPublicBranding() {
    const s = await this.get();
    return {
      systemName: s.systemName ?? DEFAULT_SYSTEM_NAME,
      loginTagline: s.loginTagline ?? null,
      loginSubtitle: s.loginSubtitle ?? DEFAULT_LOGIN_SUBTITLE,
      loginLogoUrl: s.loginLogoUrl ?? null,
      faviconUrl: s.faviconUrl ?? null,
      loginHeading: s.loginHeading ?? null,
      loginHelperText: s.loginHelperText ?? null,
      loginFooterText: s.loginFooterText ?? null,
      builtByText: s.builtByText ?? null,
    };
  }

  /** Whether a real email provider is reachable — the self-hosted SMTP relay (SMTP_HOST) or,
   * failing that, a DB/env-configured Resend key. Used to decide whether OTP-flow responses may
   * still include a `devCode` convenience field (only while nothing real is wired up yet). */
  async isEmailConfigured(): Promise<boolean> {
    const s = await this.get();
    return !!(
      this.config.get<string>('SMTP_HOST') ||
      s.resendApiKey ||
      this.config.get<string>('RESEND_API_KEY')
    );
  }

  async isSmsConfigured(): Promise<boolean> {
    const s = await this.get();
    return !!(s.advantaApiKey || this.config.get<string>('ADVANTA_API_KEY'));
  }
}
