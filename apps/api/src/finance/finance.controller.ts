import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
