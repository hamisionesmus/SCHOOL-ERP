import { Module } from '@nestjs/common';
import { HamzoneClientsController } from './clients/clients.controller';
import { HamzoneClientsService } from './clients/clients.service';
import { HamzoneInvoicesController } from './invoices/invoices.controller';
import { HamzoneInvoicesService } from './invoices/invoices.service';
import { HamzoneTrainingController } from './training/training.controller';
import { HamzoneTrainingService } from './training/training.service';
import { HamzoneLeadsController } from './leads/leads.controller';
import { HamzoneLeadsService } from './leads/leads.service';
import { HamzoneDocumentsController } from './documents/documents.controller';
import { HamzoneDocumentsService } from './documents/documents.service';
import { HamzoneApiKeysController } from './api-keys/api-keys.controller';
import { HamzoneApiKeysService } from './api-keys/api-keys.service';
import { HamzoneApiKeyGuard } from './api-keys/hamzone-api-key.guard';
import { PublicCrmController } from './public/public-crm.controller';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { PlatformEmailModule } from '../email/platform-email.module';
import { SmsProviderModule } from '../../communications/sms-provider.module';

@Module({
  imports: [PlatformSettingsModule, PlatformEmailModule, SmsProviderModule],
  controllers: [
    HamzoneClientsController,
    HamzoneInvoicesController,
    HamzoneTrainingController,
    HamzoneLeadsController,
    HamzoneDocumentsController,
    HamzoneApiKeysController,
    PublicCrmController,
  ],
  providers: [
    HamzoneClientsService,
    HamzoneInvoicesService,
    HamzoneTrainingService,
    HamzoneLeadsService,
    HamzoneDocumentsService,
    HamzoneApiKeysService,
    HamzoneApiKeyGuard,
  ],
  exports: [HamzoneInvoicesService],
})
export class CrmModule {}
