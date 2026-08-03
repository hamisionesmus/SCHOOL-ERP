import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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

// Platform-wide view — the demo-expiry and ticket-resolution survey systems both exist and send
// real links, but until this controller neither had anywhere to actually be reviewed in the
// dashboard (confirmed via research: the per-tenant endpoint above had zero frontend consumer).
@ApiTags('platform/feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole('SUPER_ADMIN')
@Controller('platform/feedback')
export class PlatformFeedbackController {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  @Get()
  async list(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('context') context?: string) {
    const p = page ? Number(page) : 1;
    const size = pageSize ? Number(pageSize) : 20;
    const where = context ? { context: context as 'DEMO_EXPIRY' | 'TICKET_RESOLUTION' } : {};
    const [data, total] = await Promise.all([
      this.platformPrisma.tenantFeedback.findMany({
        where,
        include: { tenant: { select: { name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * size,
        take: size,
      }),
      this.platformPrisma.tenantFeedback.count({ where }),
    ]);
    return { data, meta: { page: p, pageSize: size, total } };
  }

  @Get('overview')
  async overview() {
    const [ratingAgg, total, surveysSent] = await Promise.all([
      this.platformPrisma.tenantFeedback.aggregate({ _avg: { rating: true }, where: { rating: { not: null } } }),
      this.platformPrisma.tenantFeedback.count(),
      // Every ACTIVE demo that's had a reminder sent, plus every resolved ticket — the two moments a
      // survey link goes out — is the closest available "sent" denominator without a dedicated log.
      this.platformPrisma.tenant.count({ where: { isDemo: true, demoReminderSentAt: { not: null } } }),
    ]);
    return {
      averageRating: ratingAgg._avg.rating ? Math.round(ratingAgg._avg.rating * 10) / 10 : null,
      totalResponses: total,
      demoRemindersSent: surveysSent,
    };
  }
}
