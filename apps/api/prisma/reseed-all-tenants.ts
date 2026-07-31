import 'dotenv/config';
import { PrismaClient as PlatformPrismaClient } from '../generated/platform-client';
import { PrismaClient as TenantPrismaClient } from '../generated/tenant-client';
import { seedPermissionsAndRoles } from '../src/common/tenant-seed/seed-data';

/** Re-applies the (additive, idempotent) permission/role catalog to every existing tenant. Run this
 * after extending PERMISSION_CATALOG/ROLE_DEFINITIONS in seed-data.ts, alongside a schema migration
 * backfill via prisma/migrate-all-tenants.ts. */
async function main() {
  const platformPrisma = new PlatformPrismaClient();
  const tenants = await platformPrisma.tenant.findMany({ where: { deletedAt: null } });

  for (const tenant of tenants) {
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set('schema', tenant.schemaName);
    const db = new TenantPrismaClient({ datasources: { db: { url: url.toString() } } });
    await seedPermissionsAndRoles(db);
    await db.$disconnect();
    console.log(`Reseeded permissions/roles for ${tenant.slug}`);
  }

  await platformPrisma.$disconnect();
  console.log(`Done. ${tenants.length} tenant(s) reseeded.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
