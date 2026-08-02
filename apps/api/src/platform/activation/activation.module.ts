import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ActivationController } from './activation.controller';
import { ActivationAdminController } from './activation-admin.controller';
import { ActivationService } from './activation.service';
import { PlatformMpesaModule } from '../mpesa/mpesa.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [JwtModule.register({}), PlatformMpesaModule, PlatformSettingsModule, MessagingModule],
  controllers: [ActivationController, ActivationAdminController],
  providers: [ActivationService],
  exports: [ActivationService],
})
export class ActivationModule {}
