import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EmailAttachment, EmailProvider, SendEmailResult } from './email-provider.interface';

/**
 * Development/demo provider: "sends" by logging instead of calling a real email gateway. No API
 * credentials are configured for this environment — do not fabricate SendGrid/SES/Postmark keys.
 * A production deployment sets EMAIL_PROVIDER to a real implementation via env config.
 */
@Injectable()
export class StubEmailProvider implements EmailProvider {
  private readonly logger = new Logger('Email');

  async send(
    to: string,
    subject: string,
    body: string,
    attachments?: EmailAttachment[],
  ): Promise<SendEmailResult> {
    const attachmentNote = attachments?.length ? ` (+${attachments.length} attachment(s))` : '';
    this.logger.log(`[stub] -> ${to}: "${subject}"${attachmentNote}\n${body}`);
    return { success: true, providerMessageId: randomUUID() };
  }
}
