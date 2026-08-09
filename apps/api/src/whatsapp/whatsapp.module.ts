import { Module } from '@nestjs/common';
import { PlatformSettingsModule } from '../platform/platform-settings/platform-settings.module';
import { HrModule } from '../hr/hr.module';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppAdminController } from './whatsapp-admin.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppCloudProvider } from './whatsapp-cloud.provider';
import { WhatsAppRouterProvider } from './whatsapp-router.provider';
import { WHATSAPP_PROVIDER } from './whatsapp-provider.interface';
import { WhatsAppBaileysService } from './baileys/whatsapp-baileys.service';
import { WhatsAppBaileysController } from './baileys/whatsapp-baileys.controller';

@Module({
  imports: [PlatformSettingsModule, HrModule],
  controllers: [WhatsAppController, WhatsAppAdminController, WhatsAppBaileysController],
  providers: [
    WhatsAppService,
    WhatsAppCloudProvider,
    WhatsAppBaileysService,
    WhatsAppRouterProvider,
    { provide: WHATSAPP_PROVIDER, useExisting: WhatsAppRouterProvider },
  ],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
