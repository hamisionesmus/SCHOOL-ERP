import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { SetWhatsAppPinDto } from './dto/set-whatsapp-pin.dto';
import { ClearWhatsAppPinDto } from './dto/clear-whatsapp-pin.dto';

/** Any logged-in tenant user (parent/staff/teacher/admin) manages their own account here — no
 * `@RequirePermission`, same "just needs to be a valid tenant JWT" gate as HrController's leave
 * submission route. */
@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('whatsapp-pin')
  getStatus(@CurrentUser() user: JwtUserPayload) {
    return this.profileService.getWhatsAppPinStatus(user);
  }

  @Post('whatsapp-pin')
  setPin(@CurrentUser() user: JwtUserPayload, @Body() dto: SetWhatsAppPinDto) {
    return this.profileService.setWhatsAppPin(user, dto.currentPassword, dto.pin);
  }

  @Delete('whatsapp-pin')
  clearPin(@CurrentUser() user: JwtUserPayload, @Body() dto: ClearWhatsAppPinDto) {
    return this.profileService.clearWhatsAppPin(user, dto.currentPassword);
  }
}
