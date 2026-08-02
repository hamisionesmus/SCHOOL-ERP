import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

// Entirely public — the login page needs this before anyone is authenticated. Only ever exposes
// systemName/loginTagline, nothing else on PlatformSettings — see
// PlatformSettingsService.getPublicBranding().
@ApiTags('public/branding')
@Controller('public/branding')
export class BrandingController {
  constructor(private readonly platformSettings: PlatformSettingsService) {}

  @Get()
  get() {
    return this.platformSettings.getPublicBranding();
  }
}
