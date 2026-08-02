import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { SettingsOtpModule } from '../settings-otp/settings-otp.module';

@Module({
  imports: [SettingsOtpModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
