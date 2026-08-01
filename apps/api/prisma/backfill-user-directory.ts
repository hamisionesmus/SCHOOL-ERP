import 'dotenv/config';
import { PrismaClient as PlatformPrismaClient } from '../generated/platform-client';
import { PrismaClient as TenantPrismaClient } from '../generated/tenant-client';

/**
 * One-time backfill: populates UserDirectoryEntry (email → school) for every tenant User that
 * already existed before the directory was introduced (see UserDirectoryService). New users get an
 * entry automatically going forward — this script is only for pre-existing data. Safe to re-run;
 * upserts and skips genuine conflicts (same email at two schools) rather than failing the whole run.
 */
function tenantClientFor(schemaName: string) {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', schemaName);
  return new TenantPrismaClient({ datasources: { db: { url: url.toString() } } });
}

async function main() {
  const platformPrisma = new PlatformPrismaClient();
  const tenants = await platformPrisma.tenant.findMany({ where: { deletedAt: null } });

  let created = 0;
  let skippedConflicts = 0;

  for (const tenant of tenants) {
    console.log(`\n=== ${tenant.slug} (${tenant.schemaName}) ===`);
    const db = tenantClientFor(tenant.schemaName);
    const users = await db.user.findMany({ where: { deletedAt: null }, select: { email: true } });

    for (const { email } of users) {
      const existing = await platformPrisma.userDirectoryEntry.findUnique({ where: { email } });
      if (existing) {
        if (existing.tenantId !== tenant.id) {
          console.warn(
            `  CONFLICT: ${email} already claimed by another tenant (id ${existing.tenantId}) — skipping. Resolve manually.`,
          );
          skippedConflicts++;
        }
        continue;
      }
      await platformPrisma.userDirectoryEntry.create({ data: { email, tenantId: tenant.id } });
      created++;
      console.log(`  + ${email}`);
    }

    await db.$disconnect();
  }

  await platformPrisma.$disconnect();
  console.log(`\nDone. ${created} entr${created === 1 ? 'y' : 'ies'} created, ${skippedConflicts} conflict(s) skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
