import { Body, Controller, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../../common/decorators/current-user.decorator';
import { DailyLinkService } from './daily-link.service';
import { UpdateSendTimeDto } from './dto/update-send-time.dto';

@ApiTags('platform/training/daily-link')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole('TRAINER')
@Controller('platform/training/daily-link')
export class DailyLinkController {
  constructor(private readonly dailyLink: DailyLinkService) {}

  // Self-service resend for when today's automatic message didn't arrive — scoped to the caller's
  // own active program(s), no id ever passed in from the client.
  @Post('resend')
  resend(@CurrentUser() user: JwtUserPayload) {
    return this.dailyLink.resendMyLinks(user.sub);
  }

  // Lets a trainer pick what hour their own program's daily link auto-sends — ownership of the
  // program is verified server-side, not just trusted from the request.
  @Patch('my-send-time')
  updateMySendTime(@Body() dto: UpdateSendTimeDto, @CurrentUser() user: JwtUserPayload) {
    return this.dailyLink.updateMySendTime(user.sub, dto.programId, dto.sendHour);
  }
}
