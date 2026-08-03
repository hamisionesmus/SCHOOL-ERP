import { Module } from '@nestjs/common';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { SmsProviderModule } from './sms-provider.module';
import { PlatformEmailModule } from '../platform/email/platform-email.module';
import { PlatformSettingsModule } from '../platform/platform-settings/platform-settings.module';

@Module({
  imports: [SmsProviderModule, PlatformEmailModule, PlatformSettingsModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
