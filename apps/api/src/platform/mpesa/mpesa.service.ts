import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

const SANDBOX_BASE_URL = 'https://sandbox.safaricom.co.ke';
const PRODUCTION_BASE_URL = 'https://api.safaricom.co.ke';

export interface StkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
}

/** Normalizes a Kenyan phone number (07XX…, 01XX…, +2547XX… etc.) to the 2547XXXXXXXX /
 * 2541XXXXXXXX format Safaricom's Daraja API requires. */
export function normalizeKenyanPhone(input: string): string {
  const digits = input.replace(/[^\d]/g, '');
  if (/^254(7|1)\d{8}$/.test(digits)) return digits;
  if (/^0(7|1)\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^(7|1)\d{8}$/.test(digits)) return `254${digits}`;
  throw new BadRequestException('Enter a valid Kenyan phone number, e.g. 0712345678');
}

/**
 * Thin wrapper around Safaricom's Daraja "Lipa Na M-Pesa Online" (STK Push) API. Used only by the
 * platform-level school-activation flow (see ActivationService) — the tenant-level Finance module
 * has its own long-standing stub for student-fee M-Pesa payments (see MpesaStkRequest in the
 * tenant schema) which this does not touch.
 *
 * All six config values (env, consumer key/secret, shortcode, passkey, callback URL) resolve as
 * `dbValue ?? envValue` per call — DB-configured via the OTP-gated Settings screen takes priority,
 * the env var remains a working fallback. Access tokens are cached in-memory for their ~1hr
 * lifetime; changing credentials mid-cache-lifetime means the next natural expiry (well under an
 * hour) picks up the new values — not worth extra invalidation plumbing for a rare admin action.
 */
@Injectable()
export class PlatformMpesaService {
  private readonly logger = new Logger('PlatformMpesa');
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  private required(dbValue: string | null | undefined, envKey: string, label: string): string {
    const value = dbValue || this.config.get<string>(envKey);
    if (!value) {
      throw new InternalServerErrorException(
        `M-Pesa is not configured (${label}) — set it from Platform Settings > API & Payment Config.`,
      );
    }
    return value;
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.value;
    }
    const settings = await this.platformSettings.get();
    const baseUrl =
      (settings.mpesaEnv || this.config.get<string>('MPESA_ENV')) === 'production'
        ? PRODUCTION_BASE_URL
        : SANDBOX_BASE_URL;
    const consumerKey = this.required(settings.mpesaConsumerKey, 'MPESA_CONSUMER_KEY', 'Consumer Key');
    const consumerSecret = this.required(settings.mpesaConsumerSecret, 'MPESA_CONSUMER_SECRET', 'Consumer Secret');
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    const res = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) {
      this.logger.error(`Daraja OAuth failed: ${res.status} ${await res.text()}`);
      throw new InternalServerErrorException('Could not reach M-Pesa. Please try again shortly.');
    }
    const data = (await res.json()) as { access_token: string; expires_in: string };
    // Refresh a minute early to avoid a token expiring mid-use.
    this.cachedToken = { value: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000 };
    return data.access_token;
  }

  private darajaTimestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  async stkPush(params: {
    phone: string;
    amount: number;
    accountReference: string;
    description: string;
  }): Promise<StkPushResult> {
    const settings = await this.platformSettings.get();
    const baseUrl =
      (settings.mpesaEnv || this.config.get<string>('MPESA_ENV')) === 'production'
        ? PRODUCTION_BASE_URL
        : SANDBOX_BASE_URL;
    const shortcode = this.required(settings.mpesaShortcode, 'MPESA_SHORTCODE', 'Shortcode');
    const passkey = this.required(settings.mpesaPasskey, 'MPESA_PASSKEY', 'Passkey');
    const callbackUrl = this.required(settings.mpesaCallbackUrl, 'MPESA_CALLBACK_URL', 'Callback URL');
    const timestamp = this.darajaTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    const phone = normalizeKenyanPhone(params.phone);
    const token = await this.getAccessToken();

    const res = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(params.amount),
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: params.accountReference.slice(0, 12),
        TransactionDesc: params.description.slice(0, 13),
      }),
    });

    const data = (await res.json()) as {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      errorMessage?: string;
      ResponseDescription?: string;
    };
    if (!res.ok || !data.CheckoutRequestID) {
      this.logger.error(`Daraja STK push failed: ${res.status} ${JSON.stringify(data)}`);
      throw new BadRequestException(data.errorMessage ?? 'Could not start the M-Pesa payment. Please try again.');
    }
    return { merchantRequestId: data.MerchantRequestID!, checkoutRequestId: data.CheckoutRequestID };
  }
}
