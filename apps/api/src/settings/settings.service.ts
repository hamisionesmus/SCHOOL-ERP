import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../common/prisma/platform-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { renderPlatformInvoicePdf } from '../platform/billing/invoice-pdf.util';

@Injectable()
export class SettingsService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  async getSettings(user: JwtUserPayload) {
    const tenant = await this.platformPrisma.tenant.findFirst({
      where: { schemaName: user.tenantSchema!, deletedAt: null },
      include: { subscriptionPlan: true },
    });
    if (!tenant) throw new NotFoundException('School not found');
    return tenant;
  }

  async updateSettings(user: JwtUserPayload, dto: UpdateSettingsDto) {
    const tenant = await this.platformPrisma.tenant.findFirst({
      where: { schemaName: user.tenantSchema!, deletedAt: null },
    });
    if (!tenant) throw new NotFoundException('School not found');

    return this.platformPrisma.tenant.update({
      where: { id: tenant.id },
      data: { ...dto, settingsConfigured: true },
    });
  }

  /** A School Administrator's own read-only view of the Super Admin's billing records for their
   * school — same PlatformInvoice/PlatformPayment data BillingService manages, just scoped down to
   * "this tenant only" and without the issue/record-payment actions (those stay Super-Admin-only). */
  async getBilling(user: JwtUserPayload) {
    const tenant = await this.getSettings(user);
    return this.platformPrisma.platformInvoice.findMany({
      where: { tenantId: tenant.id },
      include: { payments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBillingInvoicePdf(user: JwtUserPayload, invoiceId: string): Promise<{ buffer: Buffer; filename: string }> {
    const tenant = await this.getSettings(user);
    const invoice = await this.platformPrisma.platformInvoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { orderBy: { createdAt: 'asc' } } },
    });
    if (!invoice || invoice.tenantId !== tenant.id) {
      throw new ForbiddenException('No permission to view this invoice');
    }

    const buffer = await renderPlatformInvoicePdf({
      schoolName: tenant.name,
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
    return { buffer, filename: `${slug(tenant.name)}_${invoice.invoiceNumber}.pdf` };
  }
}
