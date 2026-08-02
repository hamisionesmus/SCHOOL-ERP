import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ActivationController } from './activation.controller';
import { ActivationAdminController } from './activation-admin.controller';
import { ActivationService } from './activation.service';
import { PlatformMpesaModule } from '../mpesa/mpesa.module';
import { PlatformEmailModule } from '../email/platform-email.module';
import { SmsProviderModule } from '../../communications/sms-provider.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [
    JwtModule.register({}),
    PlatformMpesaModule,
    PlatformEmailModule,
    SmsProviderModule,
    PlatformSettingsModule,
  ],
  controllers: [ActivationController, ActivationAdminController],
  providers: [ActivationService],
  exports: [ActivationService],
})
export class ActivationModule {}
