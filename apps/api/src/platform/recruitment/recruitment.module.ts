import { Module } from '@nestjs/common';
import { RecruitmentService } from './recruitment.service';
import { RecruitmentController } from './recruitment.controller';
import { PublicRecruitmentController } from './public-recruitment.controller';
import { HamzoneApiKeysService } from '../crm/api-keys/api-keys.service';
import { HamzoneApiKeyGuard } from '../crm/api-keys/hamzone-api-key.guard';
import { MessagingModule } from '../messaging/messaging.module';
import { UserDirectoryModule } from '../../common/user-directory/user-directory.module';

// HamzoneApiKeysService/Guard aren't exported from a shared module (CrmModule registers them as
// its own providers) — registered again here the same way, matching that module's own pattern
// rather than restructuring CrmModule just to export them.
@Module({
  imports: [MessagingModule, UserDirectoryModule],
  controllers: [RecruitmentController, PublicRecruitmentController],
  providers: [RecruitmentService, HamzoneApiKeysService, HamzoneApiKeyGuard],
})
export class RecruitmentModule {}
