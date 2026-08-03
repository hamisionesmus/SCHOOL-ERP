import { Injectable } from '@nestjs/common';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  async revenueOverview() {
    const [totalRevenueAgg, tenantsByStatus, byCycle, monthly, outstandingAgg, demoCount, totalSchools] =
      await Promise.all([
        this.platformPrisma.platformPayment.aggregate({ _sum: { amount: true } }),
        this.platformPrisma.tenant.groupBy({
          by: ['status'],
          where: { deletedAt: null },
          _count: { _all: true },
        }),
        this.platformPrisma.platformInvoice.groupBy({
          by: ['billingCycle'],
          where: { status: 'PAID' },
          _sum: { amount: true },
        }),
        this.monthlyRevenue(),
        this.platformPrisma.platformInvoice.aggregate({
          where: { status: { in: ['PENDING', 'OVERDUE'] } },
          _sum: { amount: true },
        }),
        this.platformPrisma.tenant.count({ where: { deletedAt: null, isDemo: true } }),
        this.platformPrisma.tenant.count({ where: { deletedAt: null } }),
      ]);

    const statusCounts: Record<string, number> = { ACTIVE: 0, SUSPENDED: 0, TRIAL: 0 };
    for (const row of tenantsByStatus) statusCounts[row.status] = row._count._all;

    const cycleRevenue: Record<string, number> = { MONTHLY: 0, HALF_YEARLY: 0, YEARLY: 0 };
    for (const row of byCycle) cycleRevenue[row.billingCycle] = row._sum.amount ?? 0;

    return {
      totalRevenue: totalRevenueAgg._sum.amount ?? 0,
      outstanding: outstandingAgg._sum.amount ?? 0,
      totalSchools,
      activeSchools: statusCounts.ACTIVE,
      suspendedSchools: statusCounts.SUSPENDED,
      trialSchools: statusCounts.TRIAL,
      demoSchools: demoCount,
      revenueByBillingCycle: cycleRevenue,
      monthlyRevenue: monthly,
    };
  }

  /** Last 12 calendar months, sum of payments recorded in each — a lightweight in-memory bucket
   * rather than a raw SQL date_trunc, since payment volume at this app's scale is small. */
  private async monthlyRevenue() {
    const since = new Date();
    since.setMonth(since.getMonth() - 11);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const payments = await this.platformPrisma.platformPayment.findMany({
      where: { createdAt: { gte: since } },
      select: { amount: true, createdAt: true },
    });

    const buckets = new Map<string, number>();
    const cursor = new Date(since);
    for (let i = 0; i < 12; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, 0);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    for (const p of payments) {
      const key = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, (buckets.get(key) ?? 0) + p.amount);
    }
    return Array.from(buckets.entries()).map(([month, amount]) => ({ month, amount }));
  }

  async schoolsByCounty() {
    const rows = await this.platformPrisma.tenant.groupBy({
      by: ['county'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    return rows
      .map((r) => ({ county: r.county ?? 'Unspecified', count: r._count._all }))
      .sort((a, b) => b.count - a.count);
  }

  /** Escalated tickets only — the platform never sees routine tickets a school resolves internally,
   * same visibility boundary already established by the notification bell's ticket count query. */
  async ticketsOverview() {
    const rows = await this.platformPrisma.platformTicketEscalation.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const statusCounts: Record<string, number> = { PENDING: 0, ASSIGNED: 0, RESOLVED: 0 };
    for (const row of rows) statusCounts[row.status] = row._count._all;
    return {
      total: rows.reduce((sum, r) => sum + r._count._all, 0),
      ...statusCounts,
    };
  }

  async adminsOverview() {
    const [byRole, byGender] = await Promise.all([
      this.platformPrisma.platformUser.groupBy({
        by: ['role'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.platformPrisma.platformUser.groupBy({
        by: ['gender'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
    ]);
    const roleCounts: Record<string, number> = { SUPER_ADMIN: 0, ASSISTANT_SUPER_ADMIN: 0, SUB_ADMIN: 0 };
    for (const row of byRole) roleCounts[row.role] = row._count._all;
    const genderCounts: Record<string, number> = { MALE: 0, FEMALE: 0, OTHER: 0, UNSPECIFIED: 0 };
    for (const row of byGender) genderCounts[row.gender ?? 'UNSPECIFIED'] = row._count._all;
    return {
      total: byRole.reduce((sum, r) => sum + r._count._all, 0),
      byRole: roleCounts,
      byGender: genderCounts,
    };
  }
}
