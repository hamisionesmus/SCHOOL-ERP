import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { BackupsService } from './backups.service';

@ApiTags('platform/backups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform/backups')
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Get()
  list() {
    return this.backupsService.list();
  }

  @Post('run')
  trigger() {
    return this.backupsService.trigger();
  }
}
