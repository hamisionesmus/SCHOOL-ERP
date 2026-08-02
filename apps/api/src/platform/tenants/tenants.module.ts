import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { ActivationModule } from '../activation/activation.module';
import { MessagingModule } from '../messaging/messaging.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [ActivationModule, MessagingModule, PlatformSettingsModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantProvisioningService],
})
export class TenantsModule {}
