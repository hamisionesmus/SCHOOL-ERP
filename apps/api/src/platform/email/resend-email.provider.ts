import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailAttachment, EmailProvider, SendEmailResult } from './email-provider.interface';
import { StubEmailProvider } from './stub-email.provider';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

/**
 * Real outbound email via Resend (https://resend.com). Sends from a no-reply address on the
 * platform's own domain — these are one-way system notices (account creation, activation,
 * payment confirmation), not something a recipient should be able to reply to.
 *
 * Credentials are resolved per call as `dbValue ?? envValue` (DB-configured value from
 * PlatformSettings — editable via the OTP-gated Settings screen — takes priority, the env var
 * remains a working fallback for local dev / initial setup before anyone's touched the UI). If
 * neither is set, delegates to StubEmailProvider (log-only) rather than throwing, so the app never
 * hard-fails on a missing credential — it just quietly falls back to the same dev-convenience
 * behavior as before any provider existed.
 */
@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger('Email');
  private readonly stub = new StubEmailProvider();

  constructor(
    private readonly config: ConfigService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async send(
    to: string,
    subject: string,
    body: string,
    attachments?: EmailAttachment[],
  ): Promise<SendEmailResult> {
    const settings = await this.platformSettings.get();
    const apiKey = settings.resendApiKey || this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) return this.stub.send(to, subject, body, attachments);
    const from =
      settings.resendFromAddress ||
      this.config.get<string>('RESEND_FROM_ADDRESS') ||
      'School ERP <no-reply@myschoolapp.xyz>';

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
