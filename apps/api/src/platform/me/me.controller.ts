import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { MeService } from './me.service';
import { SettingsOtpService } from '../settings-otp/settings-otp.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { ConfirmSettingsChangeDto } from '../settings-otp/dto/confirm-settings-change.dto';

// Self-service profile management — both SUPER_ADMIN and SUB_ADMIN manage their own account here,
// never anyone else's (every method below is scoped by the JWT's own `sub`, ignoring any id in the
// request body).
@ApiTags('platform/me')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform/me')
export class MeController {
  constructor(
    private readonly meService: MeService,
    private readonly settingsOtp: SettingsOtpService,
  ) {}

  @Get()
  getProfile(@CurrentUser() user: JwtUserPayload) {
    return this.meService.getProfile(user.sub);
  }

  @Post('request-update')
  requestUpdate(@Body() dto: UpdateProfileDto, @CurrentUser() user: JwtUserPayload) {
    return this.settingsOtp.request(user.sub, 'PROFILE', dto);
  }

  @Post('confirm-update')
  confirmUpdate(@Body() dto: ConfirmSettingsChangeDto) {
    return this.settingsOtp.confirm(dto.requestId, dto.code);
  }

  @Post('change-password')
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: JwtUserPayload) {
    return this.meService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }

  @Post('avatar')
  updateAvatar(@Body() dto: UpdateAvatarDto, @CurrentUser() user: JwtUserPayload) {
    return this.meService.updateAvatar(user.sub, dto.avatarUrl);
  }
}
