import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FeedbackController } from './feedback.controller';
import { FeedbackAdminController, PlatformFeedbackController } from './feedback-admin.controller';
import { FeedbackService } from './feedback.service';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [JwtModule.register({}), MessagingModule],
  controllers: [FeedbackController, FeedbackAdminController, PlatformFeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
