import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { CommunicationsModule } from '../communications/communications.module';
import { MessagingModule } from '../platform/messaging/messaging.module';

@Module({
  imports: [CommunicationsModule, MessagingModule],
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
