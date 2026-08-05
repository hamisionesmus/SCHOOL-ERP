import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HamzoneMeetingsController } from './meetings.controller';
import { MeetingsPublicController } from './meetings-public.controller';
import { HamzoneMeetingsService } from './meetings.service';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [JwtModule.register({}), MessagingModule],
  controllers: [HamzoneMeetingsController, MeetingsPublicController],
  providers: [HamzoneMeetingsService],
})
export class HamzoneMeetingsModule {}
