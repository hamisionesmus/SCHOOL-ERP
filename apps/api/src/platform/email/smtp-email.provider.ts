import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailAttachment, EmailProvider, SendEmailResult } from './email-provider.interface';
import { StubEmailProvider } from './stub-email.provider';

/**
 * Real outbound email via a self-hosted Postfix relay (see the `postfix` service in
 * docker-compose.prod.yml — a `boky/postfix` sidecar reachable only inside the docker network,
 * DKIM-signing outbound mail for hamzonetechnologies.com — myschoolapp.xyz's own DNS zone was
 * found to be deprovisioned on the DNS host's end, so mail is sent as the platform operator's
 * domain instead). No third-party account/API key involved — the
 * tradeoff versus a managed ESP (Resend, SendGrid, SES) is that deliverability depends entirely on
 * this server's own IP reputation, so a PTR (reverse DNS) record for the VPS's IP and the DKIM DNS
 * TXT record this relay generates on first boot both have to be added by whoever manages the
 * domain's DNS/hosting — see docs/DEPLOYMENT.md.
 *
 * Falls back to StubEmailProvider (log-only) when SMTP_HOST isn't set, same graceful-degradation
 * pattern as every other provider in this codebase — local dev never needs this configured.
 */
@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger('Email');
  private readonly stub = new StubEmailProvider();
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  private getTransporter(): nodemailer.Transporter | null {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) return null;
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get<string>('SMTP_PORT') ?? 25),
        secure: false,
        // The relay only accepts mail from inside the docker network for domains it's configured
        // to sign for — no auth needed, same trust boundary as talking to `postgres:5432`. Its
        // opportunistic STARTTLS cert is self-signed (boky/postfix generates one internally); that's
        // fine to trust since this connection never leaves the private docker network.
        tls: { rejectUnauthorized: false },
      });
    }
    return this.transporter;
  }

  async send(
    to: string,
    subject: string,
    body: string,
    attachments?: EmailAttachment[],
    html?: string,
  ): Promise<SendEmailResult> {
    const transporter = this.getTransporter();
    if (!transporter) return this.stub.send(to, subject, body, attachments, html);
    const from = this.config.get<string>('SMTP_FROM_ADDRESS') ?? 'Hamzone Technologies <noreply@hamzonetechnologies.com>';

    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text: body,
        html,
        attachments: attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
          cid: a.cid,
        })),
      });
      return { success: true, providerMessageId: info.messageId };
    } catch (err) {
      this.logger.error(`SMTP send failed to ${to}: ${err instanceof Error ? err.message : String(err)}`);
      return { success: false };
    }
  }
}
