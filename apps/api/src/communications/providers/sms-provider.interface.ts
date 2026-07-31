export interface SendSmsResult {
  success: boolean;
  providerMessageId?: string;
}

/**
 * Provider-agnostic outbound SMS. Swap in a real provider (Africa's Talking, Twilio, Safaricom) by
 * implementing this interface and rebinding SMS_PROVIDER in communications.module.ts — no call site
 * in the rest of the app changes. See docs/ARCHITECTURE.md and docs/SRS.md §4.10.
 */
export interface SmsProvider {
  send(to: string, body: string): Promise<SendSmsResult>;
}

export const SMS_PROVIDER = 'SMS_PROVIDER';
