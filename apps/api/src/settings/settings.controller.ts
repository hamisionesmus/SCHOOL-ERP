import { Body, Controller, Get, Param, Patch, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(@CurrentUser() user: JwtUserPayload) {
    return this.settingsService.getSettings(user);
  }

  @Patch()
  @RequirePermission('SETTINGS:MANAGE')
  update(@CurrentUser() user: JwtUserPayload, @Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(user, dto);
  }

  @Get('billing')
  @RequirePermission('SETTINGS:MANAGE')
  getBilling(@CurrentUser() user: JwtUserPayload) {
    return this.settingsService.getBilling(user);
  }

  @Get('billing/:invoiceId/pdf')
  @RequirePermission('SETTINGS:MANAGE')
  async getBillingInvoicePdf(@CurrentUser() user: JwtUserPayload, @Param('invoiceId') invoiceId: string) {
    const { buffer, filename } = await this.settingsService.getBillingInvoicePdf(user, invoiceId);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
