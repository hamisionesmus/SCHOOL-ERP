import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('TENANT:MANAGE_USERS')
@Controller('roles')
export class RolesController {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload) {
    return this.tenantPrisma.forSchema(user.tenantSchema!).role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }
}
