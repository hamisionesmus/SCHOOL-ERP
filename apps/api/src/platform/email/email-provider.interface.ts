export interface SendEmailResult {
  success: boolean;
  providerMessageId?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  /** When set, the attachment is inline and referenced from the HTML body via `cid:<value>`
   * instead of appearing as a downloadable attachment (used for the embedded logo). */
  cid?: string;
}

/**
 * Provider-agnostic outbound email for platform-level notices (billing invoices/receipts to a
 * school's administrator). Mirrors the SmsProvider abstraction exactly (see
 * apps/api/src/communications/providers/sms-provider.interface.ts) — swap in a real provider
 * (SendGrid, SES, Postmark) by implementing this interface and rebinding EMAIL_PROVIDER in
 * platform-email.module.ts, no call site changes elsewhere.
 */
export interface EmailProvider {
  send(
    to: string,
    subject: string,
    body: string,
    attachments?: EmailAttachment[],
    html?: string,
  ): Promise<SendEmailResult>;
}

export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';
