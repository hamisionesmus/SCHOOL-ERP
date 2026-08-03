import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { PlatformPrismaService } from './prisma/platform-prisma.service';

async function directorySizeBytes(dir: string): Promise<number> {
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
    total += stat.isDirectory() ? await directorySizeBytes(full) : stat.size;
  }
  return total;
}

/** Real usage for a single tenant schema, not an estimate: sums pg_total_relation_size across every
 * table in that Postgres schema (works cross-schema within the same database/cluster — no
 * per-schema size function exists in Postgres, so this is the standard way to compute it) plus the
 * byte size of the tenant's local-disk uploads folder. Shared by TenantsService.getUsage() (the
 * Super-Admin-facing display) and UploadsService.save() (the enforcement check at write time) so
 * there's exactly one definition of "how big is this school" instead of two that could drift. */
export async function computeTenantStorageBytes(
  platformPrisma: PlatformPrismaService,
  schemaName: string,
): Promise<{ databaseBytes: number; uploadsBytes: number; totalBytes: number }> {
  const dbSizeResult = await platformPrisma.$queryRaw<{ bytes: bigint | null }[]>`
    SELECT COALESCE(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))), 0) AS bytes
    FROM pg_tables
    WHERE schemaname = ${schemaName}
  `;
  const databaseBytes = Number(dbSizeResult[0]?.bytes ?? 0);
  const uploadsBytes = await directorySizeBytes(join(process.cwd(), 'uploads', schemaName));
  return { databaseBytes, uploadsBytes, totalBytes: databaseBytes + uploadsBytes };
}
