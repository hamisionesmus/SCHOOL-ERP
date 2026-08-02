import { Module } from '@nestjs/common';
import { BrandingController } from './branding.controller';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [PlatformSettingsModule],
  controllers: [BrandingController],
})
export class BrandingModule {}
