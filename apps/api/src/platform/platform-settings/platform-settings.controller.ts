import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { PlatformSettingsService } from './platform-settings.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { SettingsOtpService } from '../settings-otp/settings-otp.service';
import { ConfirmSettingsChangeDto } from '../settings-otp/dto/confirm-settings-change.dto';

// Changing any of this — payment details, feature toggles, reminder windows — goes through the
// same OTP-gated request/confirm flow as tenant creation (see SettingsOtpService): a compromised
// or unattended Super Admin session shouldn't be able to silently alter platform-wide config.
@ApiTags('platform/settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform/settings')
export class PlatformSettingsController {
  constructor(
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly settingsOtp: SettingsOtpService,
  ) {}

  @Get()
  get() {
    return this.platformSettingsService.get();
  }

  @Post('request-update')
  requestUpdate(@Body() dto: UpdatePlatformSettingsDto, @CurrentUser() user: JwtUserPayload) {
    return this.settingsOtp.request(user.sub, 'SETTINGS', dto);
  }

  @Post('confirm-update')
  confirmUpdate(@Body() dto: ConfirmSettingsChangeDto) {
    return this.settingsOtp.confirm(dto.requestId, dto.code);
  }
}
