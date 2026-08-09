import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SendWhatsAppResult, WhatsAppProvider } from './whatsapp-provider.interface';

/**
 * Development/demo provider: "sends" by logging instead of calling the real WhatsApp Cloud API. Used
 * whenever the Meta credentials (access token + phone number ID) aren't configured yet — see
 * WhatsAppCloudProvider.send().
 */
@Injectable()
export class StubWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger('WhatsApp');

  async send(to: string, body: string): Promise<SendWhatsAppResult> {
    this.logger.log(`[stub] -> ${to}: ${body}`);
    return { success: true, providerMessageId: randomUUID() };
  }
}
