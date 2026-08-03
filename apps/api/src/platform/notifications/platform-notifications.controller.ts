import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { PlatformNotificationsService } from './platform-notifications.service';

@ApiTags('platform/notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform/notifications')
export class PlatformNotificationsController {
  constructor(private readonly notificationsService: PlatformNotificationsService) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload) {
    return this.notificationsService.list(user);
  }

  @Post(':notifKey/read')
  markRead(@CurrentUser() user: JwtUserPayload, @Param('notifKey') notifKey: string) {
    return this.notificationsService.markRead(user, notifKey);
  }
}
