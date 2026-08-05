import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { PlatformEmailModule } from '../email/platform-email.module';
import { SmsProviderModule } from '../../communications/sms-provider.module';

@Module({
  imports: [PlatformSettingsModule, PlatformEmailModule, SmsProviderModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
