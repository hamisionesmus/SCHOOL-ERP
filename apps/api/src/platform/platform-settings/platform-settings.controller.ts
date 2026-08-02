import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { PlatformSettingsService } from './platform-settings.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';

@ApiTags('platform/settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform/settings')
export class PlatformSettingsController {
  constructor(private readonly platformSettingsService: PlatformSettingsService) {}

  @Get()
  get() {
    return this.platformSettingsService.get();
  }

  @Patch()
  update(@Body() dto: UpdatePlatformSettingsDto) {
    return this.platformSettingsService.update(dto);
  }
}
