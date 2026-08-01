import { Module } from '@nestjs/common';
import { AuditLogAccessController } from './audit-log-access.controller';
import { AuditLogAccessService } from './audit-log-access.service';
import { PlatformEmailModule } from '../email/platform-email.module';

@Module({
  imports: [PlatformEmailModule],
  controllers: [AuditLogAccessController],
  providers: [AuditLogAccessService],
})
export class AuditLogAccessModule {}
