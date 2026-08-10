import { Body, Controller, Get, Param, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../../common/decorators/current-user.decorator';
import { HamzoneInvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { MarkInvoicePaidDto } from './dto/mark-invoice-paid.dto';

@ApiTags('platform/crm/invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform/crm/invoices')
export class HamzoneInvoicesController {
  constructor(private readonly invoices: HamzoneInvoicesService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('clientId') clientId?: string,
    @Query('overdue') overdue?: string,
  ) {
    return this.invoices.list(page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined, clientId, overdue === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoices.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: JwtUserPayload) {
    return this.invoices.create(dto, user.sub);
  }

  @Post(':id/mark-paid')
  markPaid(@Param('id') id: string, @Body() dto: MarkInvoicePaidDto) {
    return this.invoices.markPaid(id, dto);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.invoices.cancel(id);
  }

  @Post(':id/send')
  send(@Param('id') id: string) {
    return this.invoices.send(id);
  }

  @Get(':id/pdf')
  async pdf(@Param('id') id: string) {
    const { buffer, filename } = await this.invoices.downloadPdf(id);
    return new StreamableFile(buffer, { type: 'application/pdf', disposition: `attachment; filename="${filename}"` });
  }
}
