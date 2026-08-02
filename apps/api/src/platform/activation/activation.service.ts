import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { PlatformMpesaService } from '../mpesa/mpesa.service';
import { EMAIL_PROVIDER, EmailProvider } from '../email/email-provider.interface';
import { SMS_PROVIDER, SmsProvider } from '../../communications/providers/sms-provider.interface';
import { generatePlatformReceiptNumber } from '../billing/invoice-number.util';

interface ActivationTokenPayload {
  purpose: 'activation';
  tenantId: string;
  invoiceId: string;
}

interface SafaricomStkCallbackItem {
  Name: string;
  Value: string | number;
}

interface SafaricomStkCallbackBody {
  Body?: {
    stkCallback?: {
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: SafaricomStkCallbackItem[] };
    };
  };
}

/**
 * Backs the public "pay to activate your school" flow reached via the link in the welcome email
 * (see TenantsService.confirmCreate). Nothing here requires a logged-in session — the school admin
 * hasn't been able to log in yet, that's the whole point — so identity/authorization is entirely
 * carried by the signed token itself (tenantId + invoiceId, HMAC'd with the same secret used for
 * access tokens, distinguished by a `purpose` claim so it can never be confused with a real login
 * token). Always returns a 200-shaped body to the M-Pesa callback regardless of outcome — Safaricom
 * retries on anything else, which would just re-process an already-handled result.
 */
@Injectable()
export class ActivationService {
  private readonly logger = new Logger('Activation');

  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mpesa: PlatformMpesaService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  async signActivationToken(tenantId: string, invoiceId: string): Promise<string> {
    const payload: ActivationTokenPayload = { purpose: 'activation', tenantId, invoiceId };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '30d',
    });
  }

  private async verifyToken(token: string): Promise<ActivationTokenPayload> {
    let decoded: ActivationTokenPayload;
    try {
      decoded = await this.jwt.verifyAsync<ActivationTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new BadRequestException('This activation link is invalid or has expired.');
    }
    if (decoded.purpose !== 'activation') throw new BadRequestException('This activation link is invalid.');
    return decoded;
  }

  private async loadTenantAndInvoice(tenantId: string, invoiceId: string) {
    const [tenant, invoice] = await Promise.all([
      this.platformPrisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } }),
      this.platformPrisma.platformInvoice.findUnique({ where: { id: invoiceId } }),
    ]);
    if (!tenant || !invoice) throw new NotFoundException('Activation link not found');
    return { tenant, invoice };
  }

  async getStatus(token: string) {
    const { tenantId, invoiceId } = await this.verifyToken(token);
    const { tenant, invoice } = await this.loadTenantAndInvoice(tenantId, invoiceId);
    return {
      schoolName: tenant.name,
      amountKes: invoice.amount,
      status: invoice.status === 'PAID' || tenant.status === 'ACTIVE' ? 'PAID' : ('PENDING' as const),
    };
  }

  async initiatePayment(token: string, phone: string) {
    const { tenantId, invoiceId } = await this.verifyToken(token);
    const { tenant, invoice } = await this.loadTenantAndInvoice(tenantId, invoiceId);
    if (invoice.status === 'PAID') {
      throw new BadRequestException('This school has already been activated.');
    }

    const { merchantRequestId, checkoutRequestId } = await this.mpesa.stkPush({
      phone,
      amount: invoice.amount,
      accountReference: tenant.slug,
      description: 'Activation',
    });

    await this.platformPrisma.platformMpesaStkRequest.create({
      data: { invoiceId, tenantId, phone, amount: invoice.amount, checkoutRequestId, merchantRequestId },
    });

    return { checkoutRequestId };
  }

  /** Always resolves to a 200-shaped ack — see class comment on why. */
  async handleCallback(body: SafaricomStkCallbackBody) {
    const cb = body?.Body?.stkCallback;
    if (!cb?.CheckoutRequestID) {
      this.logger.warn(`Malformed M-Pesa callback: ${JSON.stringify(body)}`);
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

    const stkRequest = await this.platformPrisma.platformMpesaStkRequest.findUnique({
      where: { checkoutRequestId: cb.CheckoutRequestID },
      include: { invoice: { include: { tenant: true } } },
    });
    if (!stkRequest) {
      this.logger.warn(`Unknown checkoutRequestId in M-Pesa callback: ${cb.CheckoutRequestID}`);
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }
    if (stkRequest.status !== 'PENDING') {
      return { ResultCode: 0, ResultDesc: 'Already processed' };
    }

    if (cb.ResultCode !== 0) {
      await this.platformPrisma.platformMpesaStkRequest.update({
        where: { id: stkRequest.id },
        data: { status: 'FAILED', resultDesc: cb.ResultDesc ?? 'Payment not completed' },
      });
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

    const items = cb.CallbackMetadata?.Item ?? [];
    const get = (name: string) => items.find((i) => i.Name === name)?.Value;
    const mpesaReceiptNumber = String(get('MpesaReceiptNumber') ?? '');
    const amount = Number(get('Amount') ?? stkRequest.amount);

    const { invoice } = stkRequest;
    const { tenant } = invoice;
    const receiptNumber = await generatePlatformReceiptNumber(this.platformPrisma);

    await this.platformPrisma.$transaction([
      this.platformPrisma.platformMpesaStkRequest.update({
        where: { id: stkRequest.id },
        data: { status: 'SUCCESS', mpesaReceiptNumber, resultDesc: cb.ResultDesc },
      }),
      this.platformPrisma.platformPayment.create({
        data: {
          invoiceId: invoice.id,
          amount,
          method: 'MPESA',
          reference: mpesaReceiptNumber,
          receiptNumber,
          recordedByUserId: null,
        },
      }),
      this.platformPrisma.platformInvoice.update({ where: { id: invoice.id }, data: { status: 'PAID' } }),
      this.platformPrisma.tenant.update({
        where: { id: tenant.id },
        data: { status: 'ACTIVE', currentPeriodEnd: invoice.periodEnd },
      }),
    ]);

    const loginUrl = `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/login`;
    if (tenant.contactEmail) {
      await this.emailProvider.send(
        tenant.contactEmail,
        `${tenant.name} is now active — you can sign in`,
        `Payment received! "${tenant.name}" is now active.\n\nSign in at ${loginUrl}\n\nReceipt: ${receiptNumber} (M-Pesa ${mpesaReceiptNumber})\nAmount: KES ${amount.toLocaleString()}\n\nThis is an automated message from a no-reply address — please don't reply to it.`,
      );
    }
    if (tenant.contactPhone) {
      await this.smsProvider.send(
        tenant.contactPhone,
        `Payment received! "${tenant.name}" is now active on School ERP. Sign in at ${loginUrl}. Receipt ${receiptNumber}.`,
      );
    }

    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }
}
