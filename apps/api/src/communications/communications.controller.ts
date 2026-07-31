import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CommunicationsService } from './communications.service';
import { SendAnnouncementDto } from './dto/send-announcement.dto';

@ApiTags('communications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('communications')
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Get('messages')
  list(@CurrentUser() user: JwtUserPayload) {
    return this.communicationsService.listMessages(user);
  }

  @Post('announcements')
  @RequirePermission('ANNOUNCEMENT:SEND_TO_PARENTS')
  send(@CurrentUser() user: JwtUserPayload, @Body() dto: SendAnnouncementDto) {
    return this.communicationsService.sendAnnouncement(user, dto.recipientUserIds, dto.body);
  }
}
