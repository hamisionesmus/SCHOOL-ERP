import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';

@ApiTags('platform/subscription-plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform/subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  @Get()
  list() {
    return this.platformPrisma.subscriptionPlan.findMany({ orderBy: { priceMonthlyKes: 'asc' } });
  }
}
