import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PlatformSettingsModule } from '../platform/platform-settings/platform-settings.module';

@Module({
  imports: [PlatformSettingsModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
