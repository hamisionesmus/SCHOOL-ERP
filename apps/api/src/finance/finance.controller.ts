import { BadRequestException, Body, Controller, Get, Param, Patch, Post, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { FinanceService } from './finance.service';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { InitiateMpesaDto } from './dto/initiate-mpesa.dto';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('fee-structures')
  listFeeStructures(@CurrentUser() user: JwtUserPayload) {
    return this.financeService.listFeeStructures(user);
  }

  @Post('fee-structures')
  @RequirePermission('FINANCE:EDIT')
  createFeeStructure(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateFeeStructureDto) {
    return this.financeService.createFeeStructure(user, dto);
  }

  @Post('invoices/generate')
  @RequirePermission('FINANCE:EDIT')
  generateInvoices(@CurrentUser() user: JwtUserPayload, @Body() dto: GenerateInvoicesDto) {
    return this.financeService.generateInvoices(user, dto);
  }

  @Post('invoices')
  @RequirePermission('FINANCE:EDIT')
  createInvoice(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateInvoiceDto) {
    return this.financeService.createInvoice(user, dto);
  }

  @Get('invoices')
  listInvoices(@CurrentUser() user: JwtUserPayload) {
    return this.financeService.listInvoices(user);
  }

  @Get('invoices/export')
  @RequirePermission('FINANCE:EDIT')
  async exportInvoicesExcel(@CurrentUser() user: JwtUserPayload) {
    const buffer = await this.financeService.exportInvoicesExcel(user);
    return new StreamableFile(buffer, { type: XLSX_TYPE, disposition: 'attachment; filename="invoices-export.xlsx"' });
  }

  @Get('invoices/import-template')
  @RequirePermission('FINANCE:EDIT')
  async importInvoicesTemplate() {
    const buffer = await this.financeService.importInvoicesTemplateExcel();
    return new StreamableFile(buffer, { type: XLSX_TYPE, disposition: 'attachment; filename="invoices-import-template.xlsx"' });
  }

  @Post('invoices/import')
  @RequirePermission('FINANCE:EDIT')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importInvoicesExcel(@CurrentUser() user: JwtUserPayload, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    return this.financeService.importInvoicesFromExcel(user, file.buffer);
  }

  @Get('payments/export')
  @RequirePermission('FINANCE:EDIT')
  async exportPaymentsExcel(@CurrentUser() user: JwtUserPayload) {
    const buffer = await this.financeService.exportPaymentsExcel(user);
    return new StreamableFile(buffer, { type: XLSX_TYPE, disposition: 'attachment; filename="payments-export.xlsx"' });
  }

  @Get('payments/import-template')
  @RequirePermission('FINANCE:EDIT')
  async importPaymentsTemplate() {
    const buffer = await this.financeService.importPaymentsTemplateExcel();
    return new StreamableFile(buffer, { type: XLSX_TYPE, disposition: 'attachment; filename="payments-import-template.xlsx"' });
  }

  @Post('payments/import')
  @RequirePermission('FINANCE:RECEIVE_PAYMENT')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importPaymentsExcel(@CurrentUser() user: JwtUserPayload, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    return this.financeService.importPaymentsFromExcel(user, file.buffer);
  }

  @Get('invoices/:id')
  getInvoice(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.financeService.getInvoice(user, id);
  }

  @Post('invoices/:id/payments')
  @RequirePermission('FINANCE:RECEIVE_PAYMENT')
  recordPayment(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: RecordPaymentDto) {
    return this.financeService.recordPayment(user, id, dto);
  }

  @Post('invoices/:id/mpesa-stk')
  @RequirePermission('FINANCE:RECEIVE_PAYMENT')
  initiateMpesaStk(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: InitiateMpesaDto) {
    return this.financeService.initiateMpesaStk(user, id, dto);
  }

  @Patch('mpesa-stk/:id/confirm')
  @RequirePermission('FINANCE:RECEIVE_PAYMENT')
  confirmMpesaStk(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.financeService.confirmMpesaStk(user, id);
  }
}
