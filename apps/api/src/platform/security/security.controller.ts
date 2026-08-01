import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { SecurityService } from './security.service';

@ApiTags('platform/security')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform/security-alerts')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.securityService.listAlerts(page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  @Patch(':id/acknowledge')
  acknowledge(@Param('id') id: string) {
    return this.securityService.acknowledge(id);
  }
}
