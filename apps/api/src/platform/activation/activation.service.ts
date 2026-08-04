import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { PlatformMpesaService } from '../mpesa/mpesa.service';
import { generatePlatformReceiptNumber } from '../billing/invoice-number.util';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { findSchoolAdmin } from '../../common/tenant-admin.util';
import { generateTempPassword } from '../../common/password.util';
import { buildPlatformInvoicePdfInput, renderPlatformInvoicePdf } from '../billing/invoice-pdf.util';
import * as bcrypt from 'bcryptjs';

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
    private readonly tenantPrisma: TenantPrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mpesa: PlatformMpesaService,
    private readonly notifier: PlatformNotifierService,
    private readonly platformSettings: PlatformSettingsService,
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

  /** Lets the school download their invoice as a PDF straight from the activation page, before
   * they've ever been able to log in — same token-carries-identity approach as every other public
   * activation endpoint. Mirrors BillingService.invoicePdf() exactly, just scoped by the signed
   * token's tenantId/invoiceId instead of a raw id param an authenticated Super Admin would pass. */
  async invoicePdf(token: string): Promise<{ buffer: Buffer; filename: string }> {
    const { tenantId, invoiceId } = await this.verifyToken(token);
    const invoice = await this.platformPrisma.platformInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { tenant: true, payments: { orderBy: { createdAt: 'asc' } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const settings = await this.platformSettings.get();
    const pdfInput = buildPlatformInvoicePdfInput(invoice, invoice.tenant, settings);
    const buffer = await renderPlatformInvoicePdf(pdfInput);

    const slug = (s: string) => s.trim().replace(/[^a-zA-Z0-9]+/g, '');
    return { buffer, filename: `${slug(invoice.tenant.name)}_${invoice.invoiceNumber}.pdf` };
  }

  async initiatePayment(token: string, phone: string) {
    const { tenantId, invoiceId } = await this.verifyToken(token);
    const { tenant, invoice } = await this.loadTenantAndInvoice(tenantId, invoiceId);
    return this.pushStkForInvoice(tenant.id, tenant.slug, invoice, phone);
  }

  /** Authenticated counterpart to initiatePayment() — lets a Super/Sub Admin trigger the STK push
   * directly from the dashboard instead of relying on the school opening the activation link
   * themselves (the public flow above still works too; this is a second way in, not a replacement).
   * Finds the tenant's own pending activation invoice rather than trusting a signed token. */
  async initiatePaymentForTenant(tenantId: string, phone: string) {
    const tenant = await this.platformPrisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
    if (!tenant) throw new NotFoundException('School not found');
    if (tenant.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('This school is not awaiting activation payment.');
    }
    const invoice = await this.platformPrisma.platformInvoice.findFirst({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    if (!invoice) throw new NotFoundException('No pending activation invoice found for this school');
    return this.pushStkForInvoice(tenant.id, tenant.slug, invoice, phone);
  }

  private async pushStkForInvoice(
    tenantId: string,
    tenantSlug: string,
    invoice: { id: string; status: string; amount: number },
    phone: string,
  ) {
    if (invoice.status === 'PAID') {
      throw new BadRequestException('This school has already been activated.');
    }
    const pendingStk = await this.platformPrisma.platformMpesaStkRequest.findFirst({
      where: { invoiceId: invoice.id, status: 'PENDING' },
    });
    if (pendingStk) {
      throw new BadRequestException(
        'A payment is already in progress for this invoice — please wait for it to complete or fail before trying again.',
      );
    }
    const settings = await this.platformSettings.get();
    if (!settings.stkEnabled) {
      throw new BadRequestException('M-Pesa STK Push is currently unavailable — please use another payment method.');
    }

    const { merchantRequestId, checkoutRequestId } = await this.mpesa.stkPush({
      phone,
      amount: invoice.amount,
      accountReference: tenantSlug,
      description: 'Activation',
    });

    await this.platformPrisma.platformMpesaStkRequest.create({
      data: { invoiceId: invoice.id, tenantId, phone, amount: invoice.amount, checkoutRequestId, merchantRequestId },
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
   * end here. Generates a fresh password and states it explicitly in the message: activation can
   * happen days or weeks after the admin typed their original password into the create-school
   * dialog, and by then there's a real chance they've forgotten it — a vague "use the password you
   * set" is useless in that case. The message tells them to change it as soon as they sign in. */
  private async sendActivatedNotification(
    tenant: { name: string; schemaName: string; contactEmail: string | null; contactPhone: string | null },
    receiptNumber: string,
    amount: number,
    methodNote: string,
  ) {
    const loginUrl = `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/login`;
    const admin = await findSchoolAdmin(this.tenantPrisma, tenant.schemaName);

    let tempPassword = '';
    if (admin) {
      tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      await this.tenantPrisma.forSchema(tenant.schemaName).user.update({
        where: { id: admin.id },
        data: { passwordHash },
      });
    } else {
      this.logger.warn(`No School Administrator found for ${tenant.schemaName} — ACTIVATED message will have no password`);
    }

    await this.notifier.notify('ACTIVATED', {
      to: { email: tenant.contactEmail, phone: tenant.contactPhone },
      vars: {
        schoolName: tenant.name,
        loginUrl,
        email: tenant.contactEmail ?? admin?.email ?? '',
        tempPassword,
        receiptNumber,
        methodNote,
        amountKes: amount.toLocaleString(),
      },
    });
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

  private async notifySuperAdmins(vars: Record<string, string | number>) {
    const admins = await this.platformPrisma.platformUser.findMany({ where: { deletedAt: null } });
    for (const admin of admins) {
      await this.notifier.notify('PROOF_SUBMITTED_SUPERADMIN', {
        to: { email: admin.email, phone: admin.phone },
        vars,
      });
    }
  }

  async submitPaymentProof(token: string, method: 'BANK' | 'PAYBILL', message: string) {
    const { tenantId, invoiceId } = await this.verifyToken(token);
    const { tenant, invoice } = await this.loadTenantAndInvoice(tenantId, invoiceId);
    if (invoice.status === 'PAID') {
      throw new BadRequestException('This school has already been activated.');
    }
    const pendingProof = await this.platformPrisma.platformPaymentProof.findFirst({
      where: { invoiceId, status: 'PENDING_REVIEW' },
    });
    if (pendingProof) {
      throw new BadRequestException(
        "You already have a payment proof awaiting review for this invoice — no need to submit another. We'll notify you once it's checked.",
      );
    }
    const settings = await this.platformSettings.get();
    if (method === 'BANK' && !settings.bankTransferEnabled) {
      throw new BadRequestException('Bank transfer is currently unavailable — please use another payment method.');
    }
    if (method === 'PAYBILL' && !settings.paybillEnabled) {
      throw new BadRequestException('Paybill is currently unavailable — please use another payment method.');
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

    const methodLabel = method === 'BANK' ? 'bank transfer' : 'paybill';
    await this.notifySuperAdmins({
      schoolName: tenant.name,
      methodLabel,
      reference: reference ? `Reference: ${reference}\n` : '',
      amountKes: amount ? `Amount: KES ${amount.toLocaleString()}\n` : '',
    });
    await this.notifier.notify('PROOF_RECEIVED_SCHOOL', {
      to: { email: tenant.contactEmail, phone: tenant.contactPhone },
      vars: { schoolName: tenant.name, methodLabel },
    });

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
