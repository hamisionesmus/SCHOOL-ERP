import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { ActivationModule } from '../activation/activation.module';
import { MessagingModule } from '../messaging/messaging.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { PricingTiersModule } from '../pricing-tiers/pricing-tiers.module';
import { SystemHealthModule } from '../system-health/system-health.module';
import { SettingsOtpModule } from '../settings-otp/settings-otp.module';

@Module({
  imports: [ActivationModule, MessagingModule, PlatformSettingsModule, PricingTiersModule, SystemHealthModule, SettingsOtpModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantProvisioningService],
})
export class TenantsModule {}
