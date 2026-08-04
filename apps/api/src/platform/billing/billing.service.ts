import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { MailboxesService } from '../mailboxes/mailboxes.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { EMAIL_PROVIDER, EmailProvider } from '../email/email-provider.interface';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { generateInvoiceNumber, generatePlatformReceiptNumber } from './invoice-number.util';
import { renderPlatformInvoicePdf, buildPlatformInvoicePdfInput, PlatformInvoicePdfInput } from './invoice-pdf.util';
import { CYCLE_DAYS } from './cycle.util';
import { generateTempPassword } from '../../common/password.util';
import { findSchoolAdmin } from '../../common/tenant-admin.util';

const COMPANY_NAME = 'Hamzone Technologies';

@Injectable()
export class BillingService {
  private readonly logger = new Logger('Billing');

  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly mailboxes: MailboxesService,
    private readonly platformSettings: PlatformSettingsService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  private async findTenant(tenantId: string) {
    const tenant = await this.platformPrisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
    if (!tenant) throw new NotFoundException('School not found');
    return tenant;
  }

  private getSchoolAdmin(schemaName: string) {
    return findSchoolAdmin(this.tenantPrisma, schemaName);
  }

  async listInvoices(tenantId: string) {
    await this.findTenant(tenantId);
    return this.platformPrisma.platformInvoice.findMany({
      where: { tenantId },
      include: { payments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createInvoice(tenantId: string, dto: CreateInvoiceDto) {
    const tenant = await this.findTenant(tenantId);
    const periodStart = tenant.currentPeriodEnd && tenant.currentPeriodEnd > new Date() ? tenant.currentPeriodEnd : new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + CYCLE_DAYS[dto.billingCycle]);
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 14 * 86_400_000);

    const invoiceNumber = await generateInvoiceNumber(this.platformPrisma);
    const invoice = await this.platformPrisma.platformInvoice.create({
      data: {
        tenantId,
        billingCycle: dto.billingCycle,
        periodStart,
        periodEnd,
        amount: dto.amount,
        dueDate,
        invoiceNumber,
      },
    });

    const admin = await this.getSchoolAdmin(tenant.schemaName);
    if (admin?.email) {
      // Sent from the real billing@ mailbox (not a no-reply relay) so the school can actually reply
      // with questions — and so the exchange shows up in the Billing inbox. Best-effort: a
      // misconfigured/unconfigured billing mailbox must never block invoice creation itself.
      try {
        const settings = await this.platformSettings.get();
        const pdfInput = buildPlatformInvoicePdfInput({ ...invoice, payments: [] }, tenant, settings);
        const pdf = await renderPlatformInvoicePdf(pdfInput);
        await this.mailboxes.sendMessage('BILLING', {
          to: admin.email,
          subject: `Invoice ${invoiceNumber} — ${tenant.name}`,
          body: `A new ${dto.billingCycle.toLowerCase()} subscription invoice of KES ${dto.amount.toLocaleString()} has been issued for ${tenant.name}, due ${dueDate.toLocaleDateString()}. The invoice is attached — you can also view it any time from School Settings > Billing.`,
          attachments: [{ filename: `Invoice_${invoiceNumber}.pdf`, content: pdf, contentType: 'application/pdf' }],
        });
      } catch (err) {
        this.logger.error(`Failed to send invoice email for ${tenant.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return invoice;
  }

  async recordPayment(invoiceId: string, platformUserId: string, dto: RecordPaymentDto) {
    const invoice = await this.platformPrisma.platformInvoice.findUnique({
      where: { id: invoiceId },
      include: { tenant: true, payments: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      throw new BadRequestException(`This invoice is already ${invoice.status.toLowerCase()}`);
    }

    const receiptNumber = await generatePlatformReceiptNumber(this.platformPrisma);
    const payment = await this.platformPrisma.platformPayment.create({
      data: {
        invoiceId,
        amount: dto.amount,
        method: dto.method,
        reference: dto.reference,
        receiptNumber,
        recordedByUserId: platformUserId,
      },
    });

    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0) + dto.amount;
    if (totalPaid >= invoice.amount) {
      await this.platformPrisma.$transaction([
        this.platformPrisma.platformInvoice.update({ where: { id: invoiceId }, data: { status: 'PAID' } }),
        this.platformPrisma.tenant.update({
          where: { id: invoice.tenantId },
          data: {
            currentPeriodEnd: invoice.periodEnd,
            // A fresh period starts — clear the dedupe flag so RemindersService's daily job can warn
            // about *this* period's renewal too, not just the one that was just paid.
            renewalReminderSentAt: null,
            // Auto-restore: a school suspended for non-payment, or a non-demo school still awaiting
            // its first activation payment, gets reactivated the moment its invoice clears — whether
            // via bank transfer, cash, or M-Pesa paybill recorded here manually, or (for the
            // activation invoice specifically) the automated M-Pesa STK callback in
            // ActivationService.handleCallback(). No manual re-activation step needed either way.
            ...(invoice.tenant.status === 'SUSPENDED' || invoice.tenant.status === 'PENDING_PAYMENT'
              ? { status: 'ACTIVE' as const }
              : {}),
          },
        }),
      ]);

      const admin = await this.getSchoolAdmin(invoice.tenant.schemaName);
      if (admin?.email) {
        try {
          const settings = await this.platformSettings.get();
          const pdfInput = buildPlatformInvoicePdfInput(
            { ...invoice, status: 'PAID', payments: [...invoice.payments, payment] },
            invoice.tenant,
            settings,
          );
          const pdf = await renderPlatformInvoicePdf(pdfInput);
          await this.mailboxes.sendMessage('BILLING', {
            to: admin.email,
            subject: `Payment received — receipt ${receiptNumber}`,
            body: `We've received your payment of KES ${dto.amount.toLocaleString()} for invoice ${invoice.invoiceNumber}. Your subscription is now active through ${invoice.periodEnd.toLocaleDateString()}. Receipt ${receiptNumber} — the updated invoice/receipt is attached.`,
            attachments: [{ filename: `Receipt_${receiptNumber}.pdf`, content: pdf, contentType: 'application/pdf' }],
          });
        } catch (err) {
          this.logger.error(`Failed to send payment-received email for invoice ${invoice.invoiceNumber}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    return payment;
  }

  async invoicePdf(invoiceId: string): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.platformPrisma.platformInvoice.findUnique({
      where: { id: invoiceId },
      include: { tenant: true, payments: { orderBy: { createdAt: 'asc' } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const settings = await this.platformSettings.get();
    const pdfInput = buildPlatformInvoicePdfInput(invoice, invoice.tenant, settings);
    const buffer = await renderPlatformInvoicePdf(pdfInput);

    const slug = (s: string) => s.trim().replace(/[^a-zA-Z0-9]+/g, '');
    return { buffer, filename: `${slug(invoice.tenant.name)}_${invoice.invoiceNumber}.pdf` };
  }

  /** Generates a fresh temporary password, hashes it, and updates the School Administrator's
   * passwordHash in the tenant schema. The plaintext is returned exactly once in the API response —
   * it is never logged, never stored anywhere, and cannot be retrieved again after this call
   * returns. Real passwords are one-way bcrypt hashes and are never displayed to anyone, including
   * the Super Admin — this reset flow is the only honest way to help a locked-out school. */
  async resetSchoolAdminPassword(tenantId: string) {
    const tenant = await this.findTenant(tenantId);
    const admin = await this.getSchoolAdmin(tenant.schemaName);
    if (!admin) throw new NotFoundException('No School Administrator user found for this school');

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const db = this.tenantPrisma.forSchema(tenant.schemaName);
    await db.user.update({ where: { id: admin.id }, data: { passwordHash } });

    return { email: admin.email, fullName: admin.fullName, temporaryPassword: tempPassword };
  }

  /** Emails a sample invoice PDF (not tied to any real school/invoice) to a given address so a
   * Super Admin can review the design without needing a real invoice — sent via the general
   * no-reply relay rather than the Billing mailbox, since that mailbox may not have its own SMTP
   * credentials configured yet and design review shouldn't depend on that being done first. */
  async previewInvoiceEmail(to: string) {
    const settings = await this.platformSettings.get();
    const pdfInput: PlatformInvoicePdfInput = {
      companyName: COMPANY_NAME,
      logoUrl: settings.loginLogoUrl,
      schoolName: 'Greenfield Academy',
      schoolAddressLines: ['ATTN: School Administrator', 'Kilimani Road', 'Nairobi, Nairobi County', 'Kenya'],
      invoiceNumber: 'HZ-PREVIEW',
      lineDescription: `Monthly subscription — ${new Date().toLocaleDateString()} to ${new Date(Date.now() + 30 * 86_400_000).toLocaleDateString()}`,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 86_400_000),
      amount: 12000,
      status: 'PENDING',
      payment: {
        paybillNumber: settings.paybillEnabled ? settings.paybillNumber : null,
        bankName: settings.bankTransferEnabled ? settings.bankName : null,
        bankAccountName: settings.bankAccountName,
        bankAccountNumber: settings.bankAccountNumber,
      },
      payments: [],
      generatedAt: new Date(),
    };
    const pdf = await renderPlatformInvoicePdf(pdfInput);
    await this.emailProvider.send(
      to,
      'Invoice design preview — Hamzone Technologies',
      'This is a sample invoice PDF for design review, generated with placeholder data — not a real charge.',
      [{ filename: 'Invoice_Preview.pdf', content: pdf, contentType: 'application/pdf' }],
    );
    return { ok: true };
  }
}
