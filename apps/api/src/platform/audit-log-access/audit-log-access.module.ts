import { Module } from '@nestjs/common';
import { AuditLogAccessController } from './audit-log-access.controller';
import { AuditLogAccessService } from './audit-log-access.service';
import { PlatformEmailModule } from '../email/platform-email.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [PlatformEmailModule, PlatformSettingsModule],
  controllers: [AuditLogAccessController],
  providers: [AuditLogAccessService],
})
export class AuditLogAccessModule {}
