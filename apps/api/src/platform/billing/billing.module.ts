import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { MailboxesModule } from '../mailboxes/mailboxes.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { PlatformEmailModule } from '../email/platform-email.module';

@Module({
  imports: [MailboxesModule, PlatformSettingsModule, PlatformEmailModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
