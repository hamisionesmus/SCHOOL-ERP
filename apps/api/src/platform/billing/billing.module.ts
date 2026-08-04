import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { MailboxesModule } from '../mailboxes/mailboxes.module';

@Module({
  imports: [MailboxesModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
