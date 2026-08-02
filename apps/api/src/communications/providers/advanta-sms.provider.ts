import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendSmsResult, SmsProvider } from './sms-provider.interface';

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
 * Real outbound SMS via Advanta SMS (https://developers.advantasms.com). See
 * sms-provider.module.ts for how this is selected over StubSmsProvider (ADVANTA_API_KEY set).
 */
@Injectable()
export class AdvantaSmsProvider implements SmsProvider {
  private readonly logger = new Logger('SMS');

  constructor(private readonly config: ConfigService) {}

  async send(to: string, body: string): Promise<SendSmsResult> {
    const apikey = this.config.getOrThrow<string>('ADVANTA_API_KEY');
    const partnerID = this.config.getOrThrow<string>('ADVANTA_PARTNER_ID');
    const shortcode = this.config.get<string>('ADVANTA_SENDER_ID') ?? 'Falem Sacco';

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
