import { Body, Controller, Get, Param, Post, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { HrService } from './hr.service';
import { CreatePayslipDto } from './dto/create-payslip.dto';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/payslips')
export class HrPayslipsController {
  constructor(private readonly hrService: HrService) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload) {
    return this.hrService.listPayslips(user);
  }

  @Post()
  @RequirePermission('HR:EDIT')
  issue(@CurrentUser() user: JwtUserPayload, @Body() dto: CreatePayslipDto) {
    return this.hrService.issuePayslip(user, dto);
  }

  @Get(':id/pdf')
  async pdf(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    const { buffer, filename } = await this.hrService.payslipPdf(user, id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
