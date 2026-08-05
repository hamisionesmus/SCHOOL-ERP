import { Injectable } from '@nestjs/common';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { CreateFinanceEntryDto } from './dto/create-finance-entry.dto';

/**
 * A manual money-in/money-out ledger, distinct from PlatformPayment (school activation/renewal
 * revenue, recorded automatically by the billing/activation flows). "Total in" here always combines
 * both sources — this is the single place that answers "how much does the platform actually make."
 */
@Injectable()
export class PlatformFinanceService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  create(dto: CreateFinanceEntryDto, recordedByUserId: string) {
    return this.platformPrisma.platformFinanceEntry.create({
      data: { ...dto, recordedByUserId },
      include: { recordedBy: { select: { fullName: true } } },
    });
  }

  async list(page = 1, pageSize = 20) {
    const [data, total] = await Promise.all([
      this.platformPrisma.platformFinanceEntry.findMany({
        include: { recordedBy: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.platformPrisma.platformFinanceEntry.count(),
    ]);
    return { data, meta: { page, pageSize, total } };
  }

  async overview() {
    const [manualInAgg, manualOutAgg, paymentsAgg, hamzoneInvoiceAgg, byCategory, monthly] = await Promise.all([
      this.platformPrisma.platformFinanceEntry.aggregate({ where: { type: 'IN' }, _sum: { amount: true } }),
      this.platformPrisma.platformFinanceEntry.aggregate({ where: { type: 'OUT' }, _sum: { amount: true } }),
      this.platformPrisma.platformPayment.aggregate({ _sum: { amount: true } }),
      // Hamzone's own company invoices (training, websites, SACCO/hospital systems, etc.) —
      // distinct revenue stream from school-ERP subscriptions, but the same company, so it's
      // folded into the one combined "how much do we make" total — see HamzoneInvoice's schema
      // doc comment. Only PAID invoices count as realized revenue, same as schoolRevenue below.
      this.platformPrisma.hamzoneInvoice.aggregate({ where: { status: 'PAID' }, _sum: { total: true } }),
      this.platformPrisma.platformFinanceEntry.groupBy({
        by: ['category'],
        where: { type: 'OUT' },
        _sum: { amount: true },
      }),
      this.monthlyBreakdown(),
    ]);

    const manualIn = manualInAgg._sum.amount ?? 0;
    const schoolRevenue = paymentsAgg._sum.amount ?? 0;
    const hamzoneRevenue = hamzoneInvoiceAgg._sum.total ?? 0;
    const totalOut = manualOutAgg._sum.amount ?? 0;
    const totalIn = manualIn + schoolRevenue + hamzoneRevenue;

    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonth = monthly.find((m) => m.month === thisMonthKey);

    return {
      totalIn,
      schoolRevenue,
      hamzoneRevenue,
      manualIn,
      totalOut,
      net: totalIn - totalOut,
      thisMonthIn: thisMonth?.in ?? 0,
      thisMonthOut: thisMonth?.out ?? 0,
      monthlyBreakdown: monthly,
      byCategory: byCategory.map((c) => ({ category: c.category, amount: c._sum.amount ?? 0 })),
    };
  }

  /** Last 12 calendar months — same in-memory bucketing pattern as AnalyticsService.monthlyRevenue(),
   * extended to combine PlatformPayment (always "in"), manual PlatformFinanceEntry rows, and paid
   * HamzoneInvoice totals (bucketed by paidAt — when the money actually came in, not when the
   * invoice was raised). */
  private async monthlyBreakdown() {
    const since = new Date();
    since.setMonth(since.getMonth() - 11);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const [payments, entries, hamzoneInvoices] = await Promise.all([
      this.platformPrisma.platformPayment.findMany({
        where: { createdAt: { gte: since } },
        select: { amount: true, createdAt: true },
      }),
      this.platformPrisma.platformFinanceEntry.findMany({
        where: { createdAt: { gte: since } },
        select: { amount: true, type: true, createdAt: true },
      }),
      this.platformPrisma.hamzoneInvoice.findMany({
        where: { status: 'PAID', paidAt: { gte: since } },
        select: { total: true, paidAt: true },
      }),
    ]);

    const buckets = new Map<string, { in: number; out: number }>();
    const cursor = new Date(since);
    for (let i = 0; i < 12; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, { in: 0, out: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    for (const p of payments) {
      const bucket = buckets.get(keyOf(p.createdAt));
      if (bucket) bucket.in += p.amount;
    }
    for (const e of entries) {
      const bucket = buckets.get(keyOf(e.createdAt));
      if (!bucket) continue;
      if (e.type === 'IN') bucket.in += e.amount;
      else bucket.out += e.amount;
    }
    for (const inv of hamzoneInvoices) {
      if (!inv.paidAt) continue;
      const bucket = buckets.get(keyOf(inv.paidAt));
      if (bucket) bucket.in += inv.total;
    }
    return Array.from(buckets.entries()).map(([month, v]) => ({ month, in: v.in, out: v.out }));
  }
}
