import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { PlatformEmailModule } from '../email/platform-email.module';
import { SmsProviderModule } from '../../communications/sms-provider.module';
import { ExternalContactsModule } from '../external-contacts/external-contacts.module';

@Module({
  imports: [PlatformSettingsModule, PlatformEmailModule, SmsProviderModule, ExternalContactsModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
