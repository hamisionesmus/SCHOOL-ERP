import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { PricingTiersService } from './pricing-tiers.service';
import { UpdatePricingTiersDto } from './dto/update-pricing-tiers.dto';
import { ConfirmSettingsChangeDto } from '../settings-otp/dto/confirm-settings-change.dto';

// GET is open to any platform role — whoever can create a school needs to see the current tiers to
// preview the fee before submitting (see create-school-dialog.tsx). Only editing them is
// Super-Admin-only, OTP-gated like every other platform-wide config change.
@ApiTags('platform/pricing-tiers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform/pricing-tiers')
export class PricingTiersController {
  constructor(private readonly pricingTiers: PricingTiersService) {}

  @Get()
  list() {
    return this.pricingTiers.list();
  }

  @RequirePlatformRole('SUPER_ADMIN')
  @Post('request-update')
  requestUpdate(@Body() dto: UpdatePricingTiersDto, @CurrentUser() user: JwtUserPayload) {
    return this.pricingTiers.requestUpdate(dto, user.sub);
  }

  @RequirePlatformRole('SUPER_ADMIN')
  @Post('confirm-update')
  confirmUpdate(@Body() dto: ConfirmSettingsChangeDto) {
    return this.pricingTiers.confirmUpdate(dto.requestId, dto.code);
  }
}
