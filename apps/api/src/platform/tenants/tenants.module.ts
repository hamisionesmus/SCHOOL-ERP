import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantProvisioningService } from './tenant-provisioning.service';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, TenantProvisioningService],
})
export class TenantsModule {}
