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

    await this.sendActivatedNotification(tenant, receiptNumber, amount, `M-Pesa ${mpesaReceiptNumber}`);

    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  /** Same "you're active" messaging regardless of which payment method got the school there — the
   * M-Pesa webhook above and a Super Admin approving a Bank/Paybill proof (see approveProof) both
   * end here, so the school gets a consistent notification either way. */
  private async sendActivatedNotification(
    tenant: { name: string; contactEmail: string | null; contactPhone: string | null },
    receiptNumber: string,
    amount: number,
    methodNote: string,
  ) {
    const loginUrl = `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/login`;
    if (tenant.contactEmail) {
      await this.emailProvider.send(
        tenant.contactEmail,
        `${tenant.name} is now active — you can sign in`,
        `Payment received! "${tenant.name}" is now active.\n\nSign in at ${loginUrl}\n\nReceipt: ${receiptNumber} (${methodNote})\nAmount: KES ${amount.toLocaleString()}\n\nThis is an automated message from a no-reply address — please don't reply to it.`,
      );
    }
    if (tenant.contactPhone) {
      await this.smsProvider.send(
        tenant.contactPhone,
        `Payment received! "${tenant.name}" is now active on School ERP. Sign in at ${loginUrl}. Receipt ${receiptNumber}.`,
      );
    }
  }

  /** Best-effort read of a pasted M-Pesa/bank confirmation message — assistive only for the
   * reviewer, never trusted to auto-activate anything (see class comment on the hard line here). */
  private extractProofDetails(message: string): { amount: number | null; reference: string | null } {
    const amountMatch = message.match(/(?:KES|Ksh)\.?\s?([\d,]+(?:\.\d{2})?)/i);
    const amount = amountMatch ? Math.round(Number(amountMatch[1].replace(/,/g, ''))) : null;
    // M-Pesa confirmation codes are ~10 uppercase-alphanumeric characters (e.g. QGH7XXXX01).
    const refMatch = message.match(/\b([A-Z0-9]{10})\b/);
    return { amount, reference: refMatch ? refMatch[1] : null };
  }

  private async notifySuperAdmins(subject: string, body: string) {
    const admins = await this.platformPrisma.platformUser.findMany({ where: { deletedAt: null } });
    for (const admin of admins) {
      await this.emailProvider.send(admin.email, subject, body);
      if (admin.phone) await this.smsProvider.send(admin.phone, body);
    }
  }

  async submitPaymentProof(token: string, method: 'BANK' | 'PAYBILL', message: string) {
    const { tenantId, invoiceId } = await this.verifyToken(token);
    const { tenant, invoice } = await this.loadTenantAndInvoice(tenantId, invoiceId);
    if (invoice.status === 'PAID') {
      throw new BadRequestException('This school has already been activated.');
    }

    const { amount, reference } = this.extractProofDetails(message);
    await this.platformPrisma.platformPaymentProof.create({
      data: {
        invoiceId,
        tenantId,
        method,
        rawMessage: message,
        extractedAmount: amount,
        extractedReference: reference,
      },
    });

    await this.notifySuperAdmins(
      `Payment proof submitted — ${tenant.name}`,
      `"${tenant.name}" submitted a ${method === 'BANK' ? 'bank transfer' : 'paybill'} payment confirmation for review.\n\n${reference ? `Reference: ${reference}\n` : ''}${amount ? `Amount: KES ${amount.toLocaleString()}\n` : ''}\nReview and approve/reject it from the school's Billing tab in the Super Admin dashboard.`,
    );

    return {
      status: 'submitted' as const,
      message:
        "We've received your payment confirmation and will verify it shortly. You'll be notified once your payment is confirmed and the school unlocked. If you don't hear back or run into an issue, contact support.",
    };
  }

  async listMpesaAttempts(tenantId: string) {
    return this.platformPrisma.platformMpesaStkRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPaymentProofs(tenantId: string) {
    return this.platformPrisma.platformPaymentProof.findMany({
      where: { tenantId },
      include: { reviewedBy: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveProof(proofId: string, reviewerId: string, reviewNote?: string) {
    const proof = await this.platformPrisma.platformPaymentProof.findUnique({
      where: { id: proofId },
      include: { invoice: { include: { tenant: true } } },
    });
    if (!proof) throw new NotFoundException('Payment proof not found');
    if (proof.status !== 'PENDING_REVIEW') throw new BadRequestException(`This proof was already ${proof.status.toLowerCase().replace('_', ' ')}`);
    const { invoice } = proof;
    const { tenant } = invoice;
    if (invoice.status === 'PAID') throw new BadRequestException('This invoice is already paid');

    const receiptNumber = await generatePlatformReceiptNumber(this.platformPrisma);
    const amount = proof.extractedAmount ?? invoice.amount;

    await this.platformPrisma.$transaction([
      this.platformPrisma.platformPaymentProof.update({
        where: { id: proofId },
        data: { status: 'APPROVED', reviewedByUserId: reviewerId, reviewNote, reviewedAt: new Date() },
      }),
      this.platformPrisma.platformPayment.create({
        data: {
          invoiceId: invoice.id,
          amount,
          method: proof.method === 'BANK' ? 'BANK' : 'PAYBILL',
          reference: proof.extractedReference,
          receiptNumber,
          recordedByUserId: reviewerId,
        },
      }),
      this.platformPrisma.platformInvoice.update({ where: { id: invoice.id }, data: { status: 'PAID' } }),
      this.platformPrisma.tenant.update({
        where: { id: tenant.id },
        data: { status: 'ACTIVE', currentPeriodEnd: invoice.periodEnd },
      }),
    ]);

    await this.sendActivatedNotification(
      tenant,
      receiptNumber,
      amount,
      proof.method === 'BANK' ? 'Bank transfer' : 'Paybill',
    );

    return { success: true };
  }

  async rejectProof(proofId: string, reviewerId: string, reviewNote: string) {
    const proof = await this.platformPrisma.platformPaymentProof.findUnique({ where: { id: proofId } });
    if (!proof) throw new NotFoundException('Payment proof not found');
    if (proof.status !== 'PENDING_REVIEW') throw new BadRequestException(`This proof was already ${proof.status.toLowerCase().replace('_', ' ')}`);

    return this.platformPrisma.platformPaymentProof.update({
      where: { id: proofId },
      data: { status: 'REJECTED', reviewedByUserId: reviewerId, reviewNote, reviewedAt: new Date() },
    });
  }
}
