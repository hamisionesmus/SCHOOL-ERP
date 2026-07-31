import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PlatformEmailModule } from '../email/platform-email.module';

@Module({
  imports: [PlatformEmailModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
