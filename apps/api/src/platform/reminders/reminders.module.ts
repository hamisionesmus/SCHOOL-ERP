import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { MessagingModule } from '../messaging/messaging.module';
import { FeedbackModule } from '../feedback/feedback.module';

@Module({
  imports: [PlatformSettingsModule, MessagingModule, FeedbackModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
