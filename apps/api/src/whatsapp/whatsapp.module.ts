import { Module } from '@nestjs/common';
import { PlatformSettingsModule } from '../platform/platform-settings/platform-settings.module';
import { HrModule } from '../hr/hr.module';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppAdminController } from './whatsapp-admin.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppCloudProvider } from './whatsapp-cloud.provider';
import { WHATSAPP_PROVIDER } from './whatsapp-provider.interface';

@Module({
  imports: [PlatformSettingsModule, HrModule],
  controllers: [WhatsAppController, WhatsAppAdminController],
  providers: [WhatsAppService, WhatsAppCloudProvider, { provide: WHATSAPP_PROVIDER, useExisting: WhatsAppCloudProvider }],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
