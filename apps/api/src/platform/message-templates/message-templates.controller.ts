import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { RequirePlatformModule } from '../../common/decorators/require-platform-module.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { MessageTemplatesService } from './message-templates.service';
import { SettingsOtpService } from '../settings-otp/settings-otp.service';
import { UpdateMessageTemplateDto } from './dto/update-message-template.dto';
import { ConfirmSettingsChangeDto } from '../settings-otp/dto/confirm-settings-change.dto';

// Same OTP-gated request/confirm mechanics as PlatformSettingsController — customizing what the
// platform says shouldn't be a one-click, un-confirmed action either.
@ApiTags('platform/message-templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole('SUPER_ADMIN')
@RequirePlatformModule('MESSAGE_TEMPLATES')
@Controller('platform/message-templates')
export class MessageTemplatesController {
  constructor(
    private readonly templatesService: MessageTemplatesService,
    private readonly settingsOtp: SettingsOtpService,
  ) {}

  @Get()
  list() {
    return this.templatesService.listEffective();
  }

  @Post('request-update')
  requestUpdate(@Body() dto: UpdateMessageTemplateDto, @CurrentUser() user: JwtUserPayload) {
    const { key, ...fields } = dto;
    return this.settingsOtp.request(user.sub, 'TEMPLATES', { key, ...fields });
  }

  @Post('confirm-update')
  confirmUpdate(@Body() dto: ConfirmSettingsChangeDto) {
    return this.settingsOtp.confirm(dto.requestId, dto.code);
  }

  @Post(':key/request-reset')
  requestReset(@Param('key') key: string, @CurrentUser() user: JwtUserPayload) {
    return this.settingsOtp.request(user.sub, 'TEMPLATES', {
      key,
      subject: null,
      emailBody: null,
      smsBody: null,
    });
  }
}
