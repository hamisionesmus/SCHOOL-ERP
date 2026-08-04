import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { RequirePlatformModule } from '../../common/decorators/require-platform-module.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { PlatformSettingsService } from './platform-settings.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { UpdateBrandingImagesDto } from './dto/update-branding-images.dto';
import { SettingsOtpService } from '../settings-otp/settings-otp.service';
import { ConfirmSettingsChangeDto } from '../settings-otp/dto/confirm-settings-change.dto';

// Changing any of this — payment details, feature toggles, reminder windows — goes through the
// same OTP-gated request/confirm flow as tenant creation (see SettingsOtpService): a compromised
// or unattended Super Admin session shouldn't be able to silently alter platform-wide config.
@ApiTags('platform/settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole('SUPER_ADMIN')
@RequirePlatformModule('SETTINGS')
@Controller('platform/settings')
export class PlatformSettingsController {
  constructor(
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly settingsOtp: SettingsOtpService,
  ) {}

  @Get()
  get() {
    return this.platformSettingsService.getMaskedForClient();
  }

  @Post('request-update')
  requestUpdate(@Body() dto: UpdatePlatformSettingsDto, @CurrentUser() user: JwtUserPayload) {
    return this.settingsOtp.request(user.sub, 'SETTINGS', dto);
  }

  @Post('confirm-update')
  confirmUpdate(@Body() dto: ConfirmSettingsChangeDto) {
    return this.settingsOtp.confirm(dto.requestId, dto.code);
  }

  // Deliberately NOT OTP-gated, unlike everything else on this controller: a logo/favicon image is
  // a cosmetic asset, not sensitive config — same risk profile as a personal avatar photo (see
  // PlatformMeController.updateAvatar, also un-gated). Requiring a confirmation code here just meant
  // an upload silently failed to persist whenever the code round-trip was abandoned, which is what
  // made these fields feel "not functional" in practice.
  @Post('branding-images')
  updateBrandingImages(@Body() dto: UpdateBrandingImagesDto) {
    return this.platformSettingsService.update(dto);
  }
}
