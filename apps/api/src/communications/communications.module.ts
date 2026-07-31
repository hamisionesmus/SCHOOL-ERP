import { Module } from '@nestjs/common';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { SMS_PROVIDER } from './providers/sms-provider.interface';
import { StubSmsProvider } from './providers/stub-sms.provider';

@Module({
  controllers: [CommunicationsController],
  providers: [CommunicationsService, { provide: SMS_PROVIDER, useClass: StubSmsProvider }],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
