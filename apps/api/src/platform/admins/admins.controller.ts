import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { PlatformAdminsService } from './admins.service';
import { InviteAdminDto } from './dto/invite-admin.dto';
import { ConfirmSettingsChangeDto } from '../settings-otp/dto/confirm-settings-change.dto';

// Managing who else can act as a platform admin — real Super Admin only, never a Sub-Admin (a
// delegated admin cannot create or remove other admins, including other Sub-Admins).
@ApiTags('platform/admins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole('SUPER_ADMIN')
@Controller('platform/admins')
export class PlatformAdminsController {
  constructor(private readonly adminsService: PlatformAdminsService) {}

  @Get()
  list() {
    return this.adminsService.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminsService.findOne(id);
  }

  @Post('request-create')
  requestCreate(@Body() dto: InviteAdminDto, @CurrentUser() user: JwtUserPayload) {
    return this.adminsService.requestCreate(dto, user.sub);
  }

  @Post('confirm-create')
  confirmCreate(@Body() dto: ConfirmSettingsChangeDto) {
    return this.adminsService.confirmCreate(dto.requestId, dto.code);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() user: JwtUserPayload) {
    return this.adminsService.deactivate(id, user.sub);
  }

  @Patch(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.adminsService.reactivate(id);
  }
}
