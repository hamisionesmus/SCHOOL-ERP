import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { PlatformEmailModule } from '../email/platform-email.module';
import { SMS_PROVIDER } from '../../communications/providers/sms-provider.interface';
import { StubSmsProvider } from '../../communications/providers/stub-sms.provider';

@Module({
  imports: [PlatformEmailModule],
  controllers: [TenantsController],
  providers: [
    TenantsService,
    TenantProvisioningService,
    { provide: SMS_PROVIDER, useClass: StubSmsProvider },
  ],
})
export class TenantsModule {}
