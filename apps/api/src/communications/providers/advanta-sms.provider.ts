import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendSmsResult, SmsProvider } from './sms-provider.interface';
import { StubSmsProvider } from './stub-sms.provider';
import { PlatformSettingsService } from '../../platform/platform-settings/platform-settings.service';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';

const ADVANTA_BASE_URL = 'https://quicksms.advantasms.com';

/** 07XX…/01XX…/+2547XX… → 2547XXXXXXXX / 2541XXXXXXXX, same convention as PlatformMpesaService. */
function normalizeKenyanPhone(input: string): string {
  const digits = input.replace(/[^\d]/g, '');
  if (/^254(7|1)\d{8}$/.test(digits)) return digits;
  if (/^0(7|1)\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^(7|1)\d{8}$/.test(digits)) return `254${digits}`;
  return digits;
}

/**
 * Real outbound SMS via Advanta SMS (https://developers.advantasms.com). Credentials resolve as
 * `dbValue ?? envValue` per call (DB-configured via the OTP-gated Settings screen takes priority,
 * env var is the fallback) and fall back to StubSmsProvider (log-only) when neither is set — same
 * reasoning as ResendEmailProvider, see its doc comment.
 */
@Injectable()
export class AdvantaSmsProvider implements SmsProvider {
  private readonly logger = new Logger('SMS');
  private readonly stub = new StubSmsProvider();

  constructor(
    private readonly config: ConfigService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly platformPrisma: PlatformPrismaService,
  ) {}

  /** Best-effort usage log — every attempt, success or failure, across both platform notices and
   * tenant-side sends (this provider is the one shared instance both paths go through). Never
   * allowed to affect the actual send: a logging failure is caught and swallowed here, not
   * propagated. Powers the SMS usage stats on the System Health page. */
  private logAttempt(to: string, success: boolean, providerMessageId?: string) {
    this.platformPrisma.platformSmsLog
      .create({ data: { to, success, providerMessageId } })
      .catch((err) => this.logger.error(`Failed to record SMS usage log: ${err instanceof Error ? err.message : String(err)}`));
  }

  async send(to: string, body: string): Promise<SendSmsResult> {
    const settings = await this.platformSettings.get();
    const apikey = settings.advantaApiKey || this.config.get<string>('ADVANTA_API_KEY');
    const partnerID = settings.advantaPartnerId || this.config.get<string>('ADVANTA_PARTNER_ID');
    if (!apikey || !partnerID) return this.stub.send(to, body);
    // Last-resort fallback only — the real registered sender ID (which Kenyan telcos typically cap
    // at 11 alphanumeric characters) belongs in PlatformSettings.advantaSenderId or ADVANTA_SENDER_ID,
    // editable from the API & Payment Config settings tab.
    const shortcode = settings.advantaSenderId || this.config.get<string>('ADVANTA_SENDER_ID') || 'HamzoneTech';

    const res = await fetch(`${ADVANTA_BASE_URL}/api/services/sendsms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey, partnerID, message: body, shortcode, mobile: normalizeKenyanPhone(to) }),
    });

    const data = (await res.json()) as {
      responses?: { 'response-code': number; messageid?: string }[];
      'response-code'?: number;
    };
    const first = data.responses?.[0];
    if (!res.ok || first?.['response-code'] !== 200) {
      this.logger.error(`Advanta SMS send failed to ${to}: ${JSON.stringify(data)}`);
      this.logAttempt(to, false);
      return { success: false };
    }
    this.logAttempt(to, true, first.messageid);
    return { success: true, providerMessageId: first.messageid };
  }

  /** Current SMS credit balance from Advanta's account API — used to warn a Super Admin before the
   * account runs dry. Returns null (not a thrown error) when credentials aren't configured or the
   * call fails, so the System Health page can show "not configured"/"unavailable" instead of
   * breaking the whole page. */
  async getBalance(): Promise<{ credit: string } | null> {
    const settings = await this.platformSettings.get();
    const apikey = settings.advantaApiKey || this.config.get<string>('ADVANTA_API_KEY');
    const partnerID = settings.advantaPartnerId || this.config.get<string>('ADVANTA_PARTNER_ID');
    if (!apikey || !partnerID) return null;

    try {
      const res = await fetch(`${ADVANTA_BASE_URL}/api/services/getbalance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey, partnerID }),
      });
      const data = (await res.json()) as { 'response-code'?: number; credit?: string };
      if (!res.ok || data['response-code'] !== 200 || data.credit == null) return null;
      return { credit: data.credit };
    } catch (err) {
      this.logger.error(`Advanta balance check failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
