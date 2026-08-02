import { Module } from '@nestjs/common';
import { SettingsOtpService } from './settings-otp.service';
import { MessagingModule } from '../messaging/messaging.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { PlatformSettingsController } from '../platform-settings/platform-settings.controller';
import { MessageTemplatesController } from '../message-templates/message-templates.controller';
import { MessageTemplatesService } from '../message-templates/message-templates.service';

// Hosts both PlatformSettingsController and MessageTemplatesController — neither can live in its
// "own" module without a circular import, since both now depend on SettingsOtpService, which in
// turn depends on PlatformSettingsModule (for the settings-apply step). Composing them here keeps
// PlatformSettingsModule a plain service-only module.
@Module({
  imports: [MessagingModule, PlatformSettingsModule],
  controllers: [PlatformSettingsController, MessageTemplatesController],
  providers: [SettingsOtpService, MessageTemplatesService],
  exports: [SettingsOtpService],
})
export class SettingsOtpModule {}
