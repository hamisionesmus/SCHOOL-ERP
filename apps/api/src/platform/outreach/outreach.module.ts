import { Module } from '@nestjs/common';
import { HamzoneOutreachController } from './outreach.controller';
import { HamzoneOutreachService } from './outreach.service';
import { MessagingModule } from '../messaging/messaging.module';
import { UserDirectoryModule } from '../../common/user-directory/user-directory.module';

@Module({
  imports: [MessagingModule, UserDirectoryModule],
  controllers: [HamzoneOutreachController],
  providers: [HamzoneOutreachService],
})
export class HamzoneOutreachModule {}
