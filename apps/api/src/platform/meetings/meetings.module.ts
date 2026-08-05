import { Module } from '@nestjs/common';
import { HamzoneMeetingsController } from './meetings.controller';
import { HamzoneMeetingsService } from './meetings.service';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [MessagingModule],
  controllers: [HamzoneMeetingsController],
  providers: [HamzoneMeetingsService],
})
export class HamzoneMeetingsModule {}
