import { Module } from '@nestjs/common';
import { PricingTiersController } from './pricing-tiers.controller';
import { PricingTiersService } from './pricing-tiers.service';
import { SettingsOtpModule } from '../settings-otp/settings-otp.module';

@Module({
  imports: [SettingsOtpModule],
  controllers: [PricingTiersController],
  providers: [PricingTiersService],
  exports: [PricingTiersService],
})
export class PricingTiersModule {}
