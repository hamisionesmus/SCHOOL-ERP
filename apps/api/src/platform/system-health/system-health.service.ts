import { Injectable } from '@nestjs/common';
import * as os from 'node:os';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';

const UPLOADS_DIR = join(process.cwd(), 'uploads');

/**
 * Real container-level CPU/RAM/disk figures (via Node's `os` module and `fs.promises.statfs`,
 * available on Node 20+) plus platform-derived capacity estimates. This container has no artificial
 * disk quota below the host's own capacity (see docker-compose.prod.yml — named volumes, no
 * size-capped filesystem), so these numbers are the real, accurate picture, not a sandboxed subset.
 */
@Injectable()
export class SystemHealthService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  async overview() {
    const [cpu, memory, disk, schools, dailyActiveLogins] = await Promise.all([
      this.cpuStats(),
      this.memoryStats(),
      this.diskStats(),
      this.schoolsStorageStats(),
      this.dailyActiveLoginsLast7Days(),
    ]);

    // Disk is almost always the binding constraint for an app like this (CPU/RAM scale with request
    // volume, not stored data) — so the "N more schools" estimate is deliberately disk-only, not a
    // blended CPU/RAM/disk score, which would be harder to explain and no more accurate in practice.
    const estimatedRemainingCapacity =
      schools.count >= 2 && schools.avgStorageMbPerSchool > 0
        ? Math.floor(disk.freeMb / schools.avgStorageMbPerSchool)
        : null;

    return {
      cpu,
      memory,
      disk,
      schools: { ...schools, estimatedRemainingCapacity },
      dailyActiveLogins,
    };
  }

  private cpuStats() {
    const cpus = os.cpus();
    const [load1] = os.loadavg();
    return { cores: cpus.length, loadAvg1m: Math.round(load1 * 100) / 100 };
  }

  private memoryStats() {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const totalMb = Math.round(totalBytes / 1024 / 1024);
    const freeMb = Math.round(freeBytes / 1024 / 1024);
    return { totalMb, freeMb, usedPct: Math.round(((totalMb - freeMb) / totalMb) * 1000) / 10 };
  }

  private async diskStats() {
    try {
      const stat = await fs.statfs(UPLOADS_DIR);
      const totalMb = Math.round((stat.blocks * stat.bsize) / 1024 / 1024);
      const freeMb = Math.round((stat.bavail * stat.bsize) / 1024 / 1024);
      return { totalMb, freeMb, usedPct: totalMb > 0 ? Math.round(((totalMb - freeMb) / totalMb) * 1000) / 10 : 0 };
    } catch {
      // uploads/ may not exist yet on a completely fresh install — statfs still works on process.cwd().
      const stat = await fs.statfs(process.cwd());
      const totalMb = Math.round((stat.blocks * stat.bsize) / 1024 / 1024);
      const freeMb = Math.round((stat.bavail * stat.bsize) / 1024 / 1024);
      return { totalMb, freeMb, usedPct: totalMb > 0 ? Math.round(((totalMb - freeMb) / totalMb) * 1000) / 10 : 0 };
    }
  }

  /** One aggregate SQL query across every tenant schema's tables (pg_total_relation_size grouped by
   * schema) rather than N per-tenant round trips — same principle as TenantsService.getUsage() but
   * summed platform-wide instead of scoped to one school. */
  private async schoolsStorageStats() {
    const tenants = await this.platformPrisma.tenant.findMany({
      where: { deletedAt: null },
      select: { schemaName: true },
    });
    if (tenants.length === 0) return { count: 0, totalStorageMb: 0, avgStorageMbPerSchool: 0 };

    const schemaNames = tenants.map((t) => t.schemaName);
    const dbSizeResult = await this.platformPrisma.$queryRaw<{ bytes: bigint | null }[]>`
      SELECT COALESCE(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))), 0) AS bytes
      FROM pg_tables
      WHERE schemaname = ANY(${schemaNames})
    `;
    const dbBytes = Number(dbSizeResult[0]?.bytes ?? 0);
    const uploadsBytes = await this.directorySizeBytes(UPLOADS_DIR);
    const totalMb = Math.round(((dbBytes + uploadsBytes) / 1024 / 1024) * 100) / 100;

    return {
      count: tenants.length,
      totalStorageMb: totalMb,
      avgStorageMbPerSchool: Math.round((totalMb / tenants.length) * 100) / 100,
    };
  }

  /** Per-school breakdown behind the "which schools should be told to upgrade" question — one
   * grouped SQL query for database size (not N per-tenant round trips) plus a per-tenant uploads-
   * folder walk (uploads are on local disk, keyed by schemaName, no cross-schema SQL equivalent
   * exists for that part). Sorted by usage percentage (schools with a limit first, worst offenders
   * at the top), then by raw size for schools with no limit set. */
  async perSchoolStorage() {
    const tenants = await this.platformPrisma.tenant.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, schemaName: true, storageLimitMbOverride: true },
    });
    if (tenants.length === 0) return [];

    const schemaNames = tenants.map((t) => t.schemaName);
    const dbSizeRows = await this.platformPrisma.$queryRaw<{ schemaname: string; bytes: bigint | null }[]>`
      SELECT schemaname, COALESCE(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))), 0) AS bytes
      FROM pg_tables
      WHERE schemaname = ANY(${schemaNames})
      GROUP BY schemaname
    `;
    const dbBytesBySchema = new Map(dbSizeRows.map((r) => [r.schemaname, Number(r.bytes ?? 0)]));

    const results = await Promise.all(
      tenants.map(async (t) => {
        const dbBytes = dbBytesBySchema.get(t.schemaName) ?? 0;
        const uploadsBytes = await this.directorySizeBytes(join(UPLOADS_DIR, t.schemaName));
        const totalMb = Math.round(((dbBytes + uploadsBytes) / 1024 / 1024) * 100) / 100;
        const limitMb = t.storageLimitMbOverride ?? null;
        return {
          tenantId: t.id,
          name: t.name,
          totalMb,
          limitMb,
          usagePct: limitMb ? Math.round((totalMb / limitMb) * 1000) / 10 : null,
        };
      }),
    );

    return results.sort((a, b) => {
      if (a.usagePct !== null && b.usagePct !== null) return b.usagePct - a.usagePct;
      if (a.usagePct !== null) return -1;
      if (b.usagePct !== null) return 1;
      return b.totalMb - a.totalMb;
    });
  }

  private async directorySizeBytes(dir: string): Promise<number> {
    let total = 0;
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return 0;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      const stat = await fs.stat(full);
      total += stat.isDirectory() ? await this.directorySizeBytes(full) : stat.size;
    }
    return total;
  }

  /** Distinct successful logins per day, last 7 days — the lightweight "active users" signal this
   * app has (RefreshToken issuance), not a full request-tracing/APM system, which would be a much
   * larger build for what's meant to be an at-a-glance advisory. Fans out across every tenant schema
   * (acceptable for a low-traffic dashboard read, not a hot path) plus the platform's own logins. */
  private async dailyActiveLoginsLast7Days() {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const buckets = new Map<string, number>();
    const cursor = new Date(since);
    for (let i = 0; i < 7; i++) {
      buckets.set(cursor.toISOString().slice(0, 10), 0);
      cursor.setDate(cursor.getDate() + 1);
    }

    const platformLogins = await this.platformPrisma.platformRefreshToken.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });
    for (const row of platformLogins) {
      const key = row.createdAt.toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    const tenants = await this.platformPrisma.tenant.findMany({
      where: { deletedAt: null },
      select: { schemaName: true },
    });
    await Promise.all(
      tenants.map(async (t) => {
        const db = this.tenantPrisma.forSchema(t.schemaName);
        const rows = await db.refreshToken.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        });
        for (const row of rows) {
          const key = row.createdAt.toISOString().slice(0, 10);
          if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
        }
      }),
    );

    return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
  }
}
