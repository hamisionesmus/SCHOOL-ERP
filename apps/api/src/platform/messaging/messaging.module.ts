import { Module } from '@nestjs/common';
import { PlatformNotifierService } from './platform-notifier.service';
import { PlatformEmailModule } from '../email/platform-email.module';
import { SmsProviderModule } from '../../communications/sms-provider.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [PlatformEmailModule, SmsProviderModule, PlatformSettingsModule],
  providers: [PlatformNotifierService],
  exports: [PlatformNotifierService],
})
export class MessagingModule {}
