import { Module } from '@nestjs/common';
import { PlatformSettingsModule } from '../platform/platform-settings/platform-settings.module';
import { HrModule } from '../hr/hr.module';
import { FinanceModule } from '../finance/finance.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { ExamsModule } from '../exams/exams.module';
import { HomeworkModule } from '../homework/homework.module';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppAdminController } from './whatsapp-admin.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppCloudProvider } from './whatsapp-cloud.provider';
import { WhatsAppRouterProvider } from './whatsapp-router.provider';
import { WHATSAPP_PROVIDER } from './whatsapp-provider.interface';
import { WhatsAppBaileysService } from './baileys/whatsapp-baileys.service';
import { WhatsAppBaileysController } from './baileys/whatsapp-baileys.controller';
import { WhatsAppAssistantToolsService } from './assistant/whatsapp-assistant-tools.service';
import { WhatsAppClaudeProvider } from './assistant/whatsapp-claude.provider';
import { WhatsAppPinService } from './pin/whatsapp-pin.service';

@Module({
  imports: [PlatformSettingsModule, HrModule, FinanceModule, AttendanceModule, ExamsModule, HomeworkModule],
  controllers: [WhatsAppController, WhatsAppAdminController, WhatsAppBaileysController],
  providers: [
    WhatsAppService,
    WhatsAppCloudProvider,
    WhatsAppBaileysService,
    WhatsAppRouterProvider,
    WhatsAppAssistantToolsService,
    WhatsAppClaudeProvider,
    WhatsAppPinService,
    { provide: WHATSAPP_PROVIDER, useExisting: WhatsAppRouterProvider },
  ],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
