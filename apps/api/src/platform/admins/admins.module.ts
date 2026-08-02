import { Module } from '@nestjs/common';
import { PlatformAdminsController } from './admins.controller';
import { PlatformAdminsService } from './admins.service';
import { SettingsOtpModule } from '../settings-otp/settings-otp.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [SettingsOtpModule, MessagingModule],
  controllers: [PlatformAdminsController],
  providers: [PlatformAdminsService],
})
export class PlatformAdminsModule {}
