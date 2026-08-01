import { Global, Module } from '@nestjs/common';
import { UserDirectoryService } from './user-directory.service';

@Global()
@Module({
  providers: [UserDirectoryService],
  exports: [UserDirectoryService],
})
export class UserDirectoryModule {}
