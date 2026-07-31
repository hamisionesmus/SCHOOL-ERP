import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { EMAIL_PROVIDER, EmailProvider } from '../email/email-provider.interface';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { generateInvoiceNumber, generatePlatformReceiptNumber } from './invoice-number.util';
import { renderPlatformInvoicePdf } from './invoice-pdf.util';

const CYCLE_DAYS = { MONTHLY: 30, YEARLY: 365 } as const;

@Injectable()
export class BillingService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  private async findTenant(tenantId: string) {
    const tenant = await this.platformPrisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
    if (!tenant) throw new NotFoundException('School not found');
    return tenant;
  }

  /** The school's own User table lives in its tenant schema, not the platform schema — this is the
   * one place billing needs to reach across that boundary, same pattern used by DashboardService's
   * class-teacher lookups but cross-schema instead of cross-table. */
  private async getSchoolAdmin(schemaName: string) {
    const db = this.tenantPrisma.forSchema(schemaName);
    return db.user.findFirst({
      where: { deletedAt: null, userRoles: { some: { role: { name: 'School Administrator' } } } },
      select: { id: true, email: true, fullName: true },
    });
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
      await this.emailProvider.send(
        admin.email,
        `Invoice ${invoiceNumber} — ${tenant.name}`,
        `A new ${dto.billingCycle.toLowerCase()} subscription invoice of KES ${dto.amount.toLocaleString()} has been issued for ${tenant.name}, due ${dueDate.toLocaleDateString()}. Sign in to the School Settings > Billing page to view and download it.`,
      );
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
            // Auto-restore: a school suspended for non-payment gets reactivated the moment its
            // invoice clears, whether via bank transfer or M-Pesa paybill — no manual re-activation
            // step needed.
            ...(invoice.tenant.status === 'SUSPENDED' ? { status: 'ACTIVE' as const } : {}),
          },
        }),
      ]);

      const admin = await this.getSchoolAdmin(invoice.tenant.schemaName);
      if (admin?.email) {
        await this.emailProvider.send(
          admin.email,
          `Payment received — receipt ${receiptNumber}`,
          `We've received your payment of KES ${dto.amount.toLocaleString()} for invoice ${invoice.invoiceNumber}. Your subscription is now active through ${invoice.periodEnd.toLocaleDateString()}. Receipt ${receiptNumber}.`,
        );
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

    const buffer = await renderPlatformInvoicePdf({
      schoolName: invoice.tenant.name,
      invoiceNumber: invoice.invoiceNumber,
      billingCycle: invoice.billingCycle,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      status: invoice.status,
      payments: invoice.payments,
      generatedAt: new Date(),
    });

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

    const tempPassword = randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const db = this.tenantPrisma.forSchema(tenant.schemaName);
    await db.user.update({ where: { id: admin.id }, data: { passwordHash } });

    return { email: admin.email, fullName: admin.fullName, temporaryPassword: tempPassword };
  }

  async getAuditLogs(tenantId: string, page = 1, pageSize = 20) {
    const tenant = await this.findTenant(tenantId);
    const db = this.tenantPrisma.forSchema(tenant.schemaName);
    const [data, total] = await Promise.all([
      db.auditLog.findMany({
        include: { actor: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.auditLog.count(),
    ]);
    return { data, meta: { page, pageSize, total } };
  }
}
