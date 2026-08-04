import { Body, Controller, Get, Param, Post, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { PreviewInvoiceEmailDto } from './dto/preview-invoice-email.dto';

@ApiTags('platform/billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole('SUPER_ADMIN')
@Controller('platform')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('tenants/:id/invoices')
  listInvoices(@Param('id') id: string) {
    return this.billingService.listInvoices(id);
  }

  @Post('tenants/:id/invoices')
  createInvoice(@Param('id') id: string, @Body() dto: CreateInvoiceDto) {
    return this.billingService.createInvoice(id, dto);
  }

  @Post('invoices/:invoiceId/payments')
  recordPayment(
    @CurrentUser() user: JwtUserPayload,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.billingService.recordPayment(invoiceId, user.sub, dto);
  }

  @Get('invoices/:invoiceId/pdf')
  async invoicePdf(@Param('invoiceId') invoiceId: string) {
    const { buffer, filename } = await this.billingService.invoicePdf(invoiceId);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post('tenants/:id/reset-admin-password')
  resetAdminPassword(@Param('id') id: string) {
    return this.billingService.resetSchoolAdminPassword(id);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('billing/preview-invoice-email')
  previewInvoiceEmail(@Body() dto: PreviewInvoiceEmailDto) {
    return this.billingService.previewInvoiceEmail(dto.to);
  }
}
