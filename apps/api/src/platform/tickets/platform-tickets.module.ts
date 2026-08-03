import { Module } from '@nestjs/common';
import { PlatformTicketsController } from './platform-tickets.controller';
import { PlatformTicketsService } from './platform-tickets.service';
import { MessagingModule } from '../messaging/messaging.module';
import { CommunicationsModule } from '../../communications/communications.module';

@Module({
  imports: [MessagingModule, CommunicationsModule],
  controllers: [PlatformTicketsController],
  providers: [PlatformTicketsService],
})
export class PlatformTicketsModule {}
