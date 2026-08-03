import { Module } from '@nestjs/common';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { SmsProviderModule } from './sms-provider.module';
import { PlatformEmailModule } from '../platform/email/platform-email.module';

@Module({
  imports: [SmsProviderModule, PlatformEmailModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
