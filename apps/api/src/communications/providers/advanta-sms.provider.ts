import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendSmsResult, SmsProvider } from './sms-provider.interface';
import { StubSmsProvider } from './stub-sms.provider';
import { PlatformSettingsService } from '../../platform/platform-settings/platform-settings.service';

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
  ) {}

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
      return { success: false };
    }
    return { success: true, providerMessageId: first.messageid };
  }
}
