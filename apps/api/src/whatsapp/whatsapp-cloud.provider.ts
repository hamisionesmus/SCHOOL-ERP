import { Injectable, Logger } from '@nestjs/common';
import { SendWhatsAppResult, WhatsAppProvider } from './whatsapp-provider.interface';
import { StubWhatsAppProvider } from './stub-whatsapp.provider';
import { PlatformSettingsService } from '../platform/platform-settings/platform-settings.service';

const GRAPH_API_VERSION = 'v21.0';

/** 07XX…/01XX…/+2547XX… → 2547XXXXXXXX / 2541XXXXXXXX, same convention as AdvantaSmsProvider /
 * PlatformMpesaService — each provider keeps its own copy since the normalization is trivial and the
 * providers otherwise share nothing. WhatsApp's own wa_id arrives already in this exact format. */
function normalizeKenyanPhone(input: string): string {
  const digits = input.replace(/[^\d]/g, '');
  if (/^254(7|1)\d{8}$/.test(digits)) return digits;
  if (/^0(7|1)\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^(7|1)\d{8}$/.test(digits)) return `254${digits}`;
  return digits;
}

/**
 * Real outbound messaging via the WhatsApp Business Cloud API (Meta). Credentials resolve as
 * `dbValue ?? envValue` per call (DB-configured via the OTP-gated Settings screen takes priority, env
 * var is the fallback) and fall back to StubWhatsAppProvider (log-only) when neither is set — same
 * reasoning as AdvantaSmsProvider/ResendEmailProvider, see their doc comments.
 */
@Injectable()
export class WhatsAppCloudProvider implements WhatsAppProvider {
  private readonly logger = new Logger('WhatsApp');
  private readonly stub = new StubWhatsAppProvider();

  constructor(private readonly platformSettings: PlatformSettingsService) {}

  async send(to: string, body: string): Promise<SendWhatsAppResult> {
    const settings = await this.platformSettings.get();
    const accessToken = settings.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = settings.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!settings.whatsappEnabled || !accessToken || !phoneNumberId) return this.stub.send(to, body);

    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizeKenyanPhone(to),
        type: 'text',
        text: { body },
      }),
    });

    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message?: string };
    };
    if (!res.ok || !data.messages?.[0]?.id) {
      this.logger.error(`WhatsApp send failed to ${to}: ${JSON.stringify(data)}`);
      return { success: false };
    }
    return { success: true, providerMessageId: data.messages[0].id };
  }
}
