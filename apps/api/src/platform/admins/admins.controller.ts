import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { RequirePlatformModule } from '../../common/decorators/require-platform-module.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { PlatformAdminsService } from './admins.service';
import { InviteAdminDto } from './dto/invite-admin.dto';
import { ConfirmSettingsChangeDto } from '../settings-otp/dto/confirm-settings-change.dto';
import { SetModuleGrantsDto } from './dto/set-module-grants.dto';

// Managing who else can act as a platform admin — real Super Admin only, never a Sub-Admin (a
// delegated admin cannot create or remove other admins, including other Sub-Admins). The ADMINS
// module grant (see RequirePlatformModule) only opens the read-only list/detail views below —
// inviting, deactivating, and setting module grants stay hard Super-Admin-only (no module escape
// hatch on those methods) so a granted admin can never use it to escalate further.
@ApiTags('platform/admins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole('SUPER_ADMIN')
@Controller('platform/admins')
export class PlatformAdminsController {
  constructor(private readonly adminsService: PlatformAdminsService) {}

  @RequirePlatformModule('ADMINS')
  @Get()
  list(@Query('q') q?: string) {
    return this.adminsService.list(q);
  }

  @RequirePlatformModule('ADMINS')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminsService.findOne(id);
  }

  @Get(':id/module-grants')
  getModuleGrants(@Param('id') id: string) {
    return this.adminsService.getModuleGrants(id);
  }

  @Put(':id/module-grants')
  setModuleGrants(@Param('id') id: string, @Body() dto: SetModuleGrantsDto) {
    return this.adminsService.setModuleGrants(id, dto.modules);
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
