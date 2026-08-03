import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../common/prisma/platform-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { renderPlatformInvoicePdf } from '../platform/billing/invoice-pdf.util';

// The fields that actually make a school look "set up" — identity + report-card content. Excludes
// purely cosmetic color pickers and the rarely-touched SMS sender ID, which aren't worth blocking
// onboarding over. Mirrored in apps/web/src/app/school/settings/page.tsx (no shared package exists
// between the two apps yet — same duplication precedent as KENYA_COUNTIES).
const REQUIRED_FIELDS = ['name', 'logoUrl', 'address', 'mission', 'vision', 'motto'] as const;

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

    // Computed from actual field completeness (post-update) rather than an unconditional flip —
    // previously ANY successful save, even just uploading a logo, permanently marked the school
    // "configured" regardless of what was still blank, which defeated the whole point of the
    // first-login redirect (see school/layout.tsx's needsSettingsRedirect).
    const merged = { ...tenant, ...dto } as Record<string, unknown>;
    const settingsConfigured = REQUIRED_FIELDS.every((f) => !!merged[f]);

    return this.platformPrisma.tenant.update({
      where: { id: tenant.id },
      data: { ...dto, settingsConfigured },
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
