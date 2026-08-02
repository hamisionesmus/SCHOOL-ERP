import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { RequestTenantDto } from './dto/request-tenant.dto';
import { ConfirmTenantDto } from './dto/confirm-tenant.dto';
import { UpdatePaymentConfigDto } from './dto/update-payment-config.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('platform/tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.tenantsService.list(page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Get(':id/usage')
  getUsage(@Param('id') id: string) {
    return this.tenantsService.getUsage(id);
  }

  @Get(':id/activation-link')
  getActivationLink(@Param('id') id: string) {
    return this.tenantsService.getActivationLink(id);
  }

  @Post('request')
  requestCreate(@Body() dto: RequestTenantDto, @CurrentUser() user: JwtUserPayload) {
    return this.tenantsService.requestCreate(dto, user.sub);
  }

  @Post('confirm')
  confirmCreate(@Body() dto: ConfirmTenantDto) {
    return this.tenantsService.confirmCreate(dto);
  }

  // Suspend/activate/payment-config are more consequential than plain creation — a Sub-Admin can
  // start a school (still gated by the main Super Admin's OTP, see TenantsService.requestCreate)
  // but can't lock out or redirect payments for an existing one.
  @RequirePlatformRole('SUPER_ADMIN')
  @Patch(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.tenantsService.suspend(id);
  }

  @RequirePlatformRole('SUPER_ADMIN')
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.tenantsService.activate(id);
  }

  @RequirePlatformRole('SUPER_ADMIN')
  @Patch(':id/payment-config')
  updatePaymentConfig(@Param('id') id: string, @Body() dto: UpdatePaymentConfigDto) {
    return this.tenantsService.updatePaymentConfig(id, dto);
  }
}
