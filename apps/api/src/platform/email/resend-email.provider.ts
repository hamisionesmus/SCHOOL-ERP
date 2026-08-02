import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailAttachment, EmailProvider, SendEmailResult } from './email-provider.interface';

/**
 * Real outbound email via Resend (https://resend.com). Sends from a no-reply address on the
 * platform's own domain — these are one-way system notices (account creation, activation,
 * payment confirmation), not something a recipient should be able to reply to. See
 * platform-email.module.ts for how this is selected over StubEmailProvider (RESEND_API_KEY set).
 */
@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger('Email');

  constructor(private readonly config: ConfigService) {}

  async send(
    to: string,
    subject: string,
    body: string,
    attachments?: EmailAttachment[],
  ): Promise<SendEmailResult> {
    const apiKey = this.config.getOrThrow<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM_ADDRESS') ?? 'School ERP <no-reply@myschoolapp.xyz>';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: body,
        attachments: attachments?.map((a) => ({
          filename: a.filename,
          content: a.content.toString('base64'),
        })),
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      this.logger.error(`Resend send failed (${res.status}) to ${to}: ${errBody}`);
      return { success: false };
    }
    const data = (await res.json()) as { id: string };
    return { success: true, providerMessageId: data.id };
  }
}
