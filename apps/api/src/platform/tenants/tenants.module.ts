import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { PlatformEmailModule } from '../email/platform-email.module';
import { SmsProviderModule } from '../../communications/sms-provider.module';
import { ActivationModule } from '../activation/activation.module';

@Module({
  imports: [PlatformEmailModule, SmsProviderModule, ActivationModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantProvisioningService],
})
export class TenantsModule {}
