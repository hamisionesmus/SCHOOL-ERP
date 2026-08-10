import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../../../common/prisma/platform-prisma.service';
import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import { EMAIL_PROVIDER, EmailProvider } from '../../email/email-provider.interface';
import { SMS_PROVIDER, SmsProvider } from '../../../communications/providers/sms-provider.interface';
import { buildLogoAttachment, wrapWithLogo } from '../../messaging/render-email-html';
import { generateHamzoneInvoiceNumber } from './hamzone-invoice-number.util';
import { renderHamzoneInvoicePdf } from './hamzone-invoice-pdf.util';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { MarkInvoicePaidDto } from './dto/mark-invoice-paid.dto';

/**
 * Company invoicing for every Hamzone Technologies product line, VAT-inclusive — deliberately
 * separate from PlatformInvoice (a school's recurring ERP subscription fee). See HamzoneInvoice's
 * schema doc comment; PlatformFinanceService.overview() is what folds this revenue into the one
 * combined "how much does the company make" total.
 */
@Injectable()
export class HamzoneInvoicesService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly settings: PlatformSettingsService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  async list(page = 1, pageSize = 30, clientId?: string, overdue?: boolean) {
    // HamzoneInvoiceStatus.OVERDUE is never actually set by any write path — computed live here
    // instead of trusting the stored enum, same reasoning as the platform notification bell's
    // "crm-invoices-overdue" item.
    const where = {
      ...(clientId ? { clientId } : {}),
      ...(overdue ? { status: 'PENDING' as const, dueDate: { lt: new Date() } } : {}),
    };
    const [data, total] = await Promise.all([
      this.platformPrisma.hamzoneInvoice.findMany({
        where,
        include: { client: { select: { name: true, email: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.platformPrisma.hamzoneInvoice.count({ where }),
    ]);
    return { data, meta: { page, pageSize, total } };
  }

  async findOne(id: string) {
    const invoice = await this.platformPrisma.hamzoneInvoice.findUnique({
      where: { id },
      include: { client: true, createdBy: { select: { fullName: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async create(dto: CreateInvoiceDto, userId: string) {
    const client = await this.platformPrisma.hamzoneClient.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Client not found');

    const vatRate = dto.vatRate ?? 16;
    const vatAmount = Math.round((dto.subtotal * vatRate) / 100);
    const total = dto.subtotal + vatAmount;
    const invoiceNumber = await generateHamzoneInvoiceNumber(this.platformPrisma);

    return this.platformPrisma.hamzoneInvoice.create({
      data: {
        invoiceNumber,
        clientId: dto.clientId,
        productLine: dto.productLine,
        purpose: dto.productLine === 'OTHER' ? dto.purpose : undefined,
        description: dto.description,
        subtotal: dto.subtotal,
        vatRate,
        vatAmount,
        total,
        dueDate: new Date(dto.dueDate),
        createdByUserId: userId,
      },
      include: { client: true },
    });
  }

  async markPaid(id: string, dto: MarkInvoicePaidDto) {
    const invoice = await this.findOne(id);
    if (invoice.status === 'PAID') throw new BadRequestException('This invoice is already marked paid');
    return this.platformPrisma.hamzoneInvoice.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date(), paymentMethod: dto.paymentMethod, paymentReference: dto.paymentReference },
    });
  }

  async cancel(id: string) {
    const invoice = await this.findOne(id);
    if (invoice.status === 'PAID') throw new BadRequestException('A paid invoice cannot be cancelled');
    return this.platformPrisma.hamzoneInvoice.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  private async buildPdf(invoice: Awaited<ReturnType<HamzoneInvoicesService['findOne']>>) {
    const settings = await this.settings.get();
    const contactLines = [invoice.client.contactName, invoice.client.email, invoice.client.phone].filter(
      (l): l is string => !!l,
    );
    return renderHamzoneInvoicePdf({
      logoUrl: settings.loginLogoUrl,
      clientName: invoice.client.name,
      clientContactLines: contactLines,
      invoiceNumber: invoice.invoiceNumber,
      productLine: invoice.productLine,
      purpose: invoice.purpose,
      description: invoice.description,
      invoiceDate: invoice.createdAt,
      dueDate: invoice.dueDate,
      subtotal: invoice.subtotal,
      vatRate: invoice.vatRate,
      vatAmount: invoice.vatAmount,
      total: invoice.total,
      status: invoice.status,
      paidAt: invoice.paidAt,
      paymentMethod: invoice.paymentMethod,
      paymentReference: invoice.paymentReference,
      payment: {
        paybillNumber: settings.paybillEnabled ? settings.paybillNumber : null,
        bankName: settings.bankTransferEnabled ? settings.bankName : null,
        bankAccountName: settings.bankAccountName,
        bankAccountNumber: settings.bankAccountNumber,
      },
      contact: {
        supportPhone: settings.supportPhone,
        supportWebsite: settings.supportWebsite,
        billingEmail: settings.billingEmail,
      },
      generatedAt: new Date(),
    });
  }

  async downloadPdf(id: string) {
    const invoice = await this.findOne(id);
    const buffer = await this.buildPdf(invoice);
    return { buffer, filename: `${invoice.invoiceNumber}.pdf` };
  }

  /** Emails and/or SMSes the invoice (PDF attached to the email) to whatever contact details the
   * client has on file — same direct-provider pattern as CampaignsService, since this is one-off
   * authored content per invoice rather than a keyed system template. Actually inspects each
   * provider's result rather than treating "didn't throw" as delivered — mirrors
   * CampaignRecipient's emailStatus/smsStatus/emailError/smsError tracking, since "we called the
   * provider" and "the client actually received it" are not the same claim. */
  async send(id: string) {
    const invoice = await this.findOne(id);
    if (!invoice.client.email && !invoice.client.phone) {
      throw new BadRequestException('This client has no email or phone on file to send the invoice to');
    }
    const settings = await this.settings.get();
    const buffer = await this.buildPdf(invoice);
    const body = `Invoice ${invoice.invoiceNumber} from Hamzone Technologies — ${invoice.description}. Total due: KES ${invoice.total.toLocaleString()} by ${invoice.dueDate.toLocaleDateString()}. This is an electronically generated invoice.`;

    const data: Record<string, unknown> = {};

    if (invoice.client.email && settings.emailEnabled) {
      try {
        const logoAttachment = await buildLogoAttachment(settings.loginLogoUrl);
        const html = wrapWithLogo(body, !!logoAttachment);
        const attachments = [
          { filename: `${invoice.invoiceNumber}.pdf`, content: buffer, contentType: 'application/pdf' },
          ...(logoAttachment ? [logoAttachment] : []),
        ];
        const result = await this.emailProvider.send(
          invoice.client.email,
          `Invoice ${invoice.invoiceNumber} — Hamzone Technologies`,
          body,
          attachments,
          html,
        );
        data.emailSentAt = new Date();
        data.emailStatus = result.success ? 'SENT' : 'FAILED';
        data.emailError = result.success ? null : 'Email provider reported the send failed';
      } catch (err) {
        data.emailSentAt = new Date();
        data.emailStatus = 'FAILED';
        data.emailError = err instanceof Error ? err.message : 'Unknown email delivery error';
      }
    } else {
      data.emailStatus = 'SKIPPED';
    }

    if (invoice.client.phone && settings.smsEnabled) {
      try {
        const result = await this.smsProvider.send(invoice.client.phone, body);
        data.smsSentAt = new Date();
        data.smsStatus = result.success ? 'SENT' : 'FAILED';
        data.smsError = result.success ? null : 'SMS provider reported the send failed';
      } catch (err) {
        data.smsSentAt = new Date();
        data.smsStatus = 'FAILED';
        data.smsError = err instanceof Error ? err.message : 'Unknown SMS delivery error';
      }
    } else {
      data.smsStatus = 'SKIPPED';
    }

    await this.platformPrisma.hamzoneInvoice.update({ where: { id }, data });
    return this.findOne(id);
  }
}
