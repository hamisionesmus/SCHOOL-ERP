import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';

@ApiTags('platform/feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole('SUPER_ADMIN')
@Controller('platform/tenants/:id/feedback')
export class FeedbackAdminController {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  @Get()
  list(@Param('id') tenantId: string) {
    return this.platformPrisma.tenantFeedback.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
