import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { PrismaClient as PlatformPrismaClient } from '../generated/platform-client';

/**
 * Backfills already-provisioned tenant schemas with any tenant migrations added after they were
 * created (brand-new tenants get every migration automatically via TenantProvisioningService — this
 * script is for the existing ones). Run after adding a new migration under prisma/tenant/migrations.
 *
 * Tenants provisioned before the switch to `prisma migrate deploy` (see tenant-provisioning.service.ts)
 * have their tables but no `_prisma_migrations` history table. For those we "baseline" by marking the
 * first migration as already-applied (schema-resolve, not a real run) before deploying the rest.
 */
async function hasMigrationHistory(schemaName: string): Promise<boolean> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const res = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = '_prisma_migrations'`,
      [schemaName],
    );
    return (res.rowCount ?? 0) > 0;
  } finally {
    await client.end();
  }
}

function firstMigrationName(): string {
  const migrationsDir = join(__dirname, 'tenant', 'migrations');
  const [first] = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  return first;
}

async function main() {
  const platformPrisma = new PlatformPrismaClient();
  const tenants = await platformPrisma.tenant.findMany({ where: { deletedAt: null } });

  for (const tenant of tenants) {
    console.log(`\n=== ${tenant.slug} (${tenant.schemaName}) ===`);
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set('schema', tenant.schemaName);
    const env = { ...process.env, TENANT_TEMPLATE_DATABASE_URL: url.toString() };

    if (!(await hasMigrationHistory(tenant.schemaName))) {
      const baseline = firstMigrationName();
      console.log(`No migration history found — baselining at ${baseline}...`);
      execFileSync(
        'npx',
        ['prisma', 'migrate', 'resolve', '--applied', baseline, '--schema=prisma/tenant/schema.prisma'],
        { env, stdio: 'inherit', shell: true },
      );
    }

    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema=prisma/tenant/schema.prisma'], {
      env,
      stdio: 'inherit',
      shell: true,
    });
  }

  await platformPrisma.$disconnect();
  console.log(`\nDone. ${tenants.length} tenant(s) migrated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
