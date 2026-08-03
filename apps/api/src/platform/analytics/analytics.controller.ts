import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';

@ApiTags('platform/analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('revenue')
  revenue(@CurrentUser() user: JwtUserPayload) {
    return this.analyticsService.revenueOverview(user.role === 'SUB_ADMIN' ? user.sub : undefined);
  }

  @Get('schools-by-county')
  schoolsByCounty(@CurrentUser() user: JwtUserPayload) {
    return this.analyticsService.schoolsByCounty(user.role === 'SUB_ADMIN' ? user.sub : undefined);
  }

  @Get('tickets')
  tickets() {
    return this.analyticsService.ticketsOverview();
  }

  @Get('admins')
  admins() {
    return this.analyticsService.adminsOverview();
  }
}
