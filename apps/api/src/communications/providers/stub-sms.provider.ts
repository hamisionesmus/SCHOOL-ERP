import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SendSmsResult, SmsProvider } from './sms-provider.interface';

/**
 * Development/demo provider: "sends" by logging instead of calling a real SMS gateway. No API
 * credentials are configured for this environment — do not fabricate Africa's Talking/Twilio keys.
 * A production deployment sets SMS_PROVIDER to a real implementation via env config.
 */
@Injectable()
export class StubSmsProvider implements SmsProvider {
  private readonly logger = new Logger('SMS');

  async send(to: string, body: string): Promise<SendSmsResult> {
    this.logger.log(`[stub] -> ${to}: ${body}`);
    return { success: true, providerMessageId: randomUUID() };
  }
}
