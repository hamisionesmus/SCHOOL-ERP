import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient as PlatformPrismaClient } from '../generated/platform-client';
import { PrismaClient as TenantPrismaClient } from '../generated/tenant-client';
import { seedTenantCore } from '../src/common/tenant-seed/seed-data';

const platformPrisma = new PlatformPrismaClient();

async function provisionSchema(schemaName: string) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    const migrationsDir = join(__dirname, 'tenant', 'migrations');
    const folders = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    for (const folder of folders) {
      const sql = readFileSync(join(migrationsDir, folder, 'migration.sql'), 'utf-8');
      await client.query(`SET search_path TO "${schemaName}", public;`);
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
}

function tenantClientFor(schemaName: string) {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', schemaName);
  return new TenantPrismaClient({ datasources: { db: { url: url.toString() } } });
}

async function main() {
  console.log('Seeding subscription plans...');
  await platformPrisma.subscriptionPlan.upsert({
    where: { name: 'Starter' },
    update: {},
    create: { name: 'Starter', maxStudents: 300, maxStaff: 40, storageLimitMb: 5000, priceMonthlyKes: 4999 },
  });
  await platformPrisma.subscriptionPlan.upsert({
    where: { name: 'Growth' },
    update: {},
    create: { name: 'Growth', maxStudents: 1500, maxStaff: 150, storageLimitMb: 25000, priceMonthlyKes: 14999 },
  });

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? 'superadmin@school-erp.local';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';
  console.log(`Seeding Super Admin (${superAdminEmail})...`);
  const passwordHash = await bcrypt.hash(superAdminPassword, 12);
  await platformPrisma.platformUser.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: { email: superAdminEmail, fullName: 'Platform Super Admin', passwordHash },
  });

  const demoSlug = 'demo-academy';
  const demoSchema = `tenant_${demoSlug.replace(/-/g, '_')}`;
  const existingDemo = await platformPrisma.tenant.findUnique({ where: { slug: demoSlug } });
  if (!existingDemo) {
    console.log('Provisioning demo tenant "Demo Academy"...');
    const demoTenant = await platformPrisma.tenant.create({
      data: { name: 'Demo Academy', slug: demoSlug, schemaName: demoSchema, status: 'ACTIVE' },
    });
    await provisionSchema(demoSchema);
    // See UserDirectoryService — every tenant User needs an entry here so login can resolve which
    // school an email belongs to without asking for a school slug.
    await platformPrisma.userDirectoryEntry.upsert({
      where: { email: 'admin@demo-academy.local' },
      update: {},
      create: { email: 'admin@demo-academy.local', tenantId: demoTenant.id },
    });
    const db = tenantClientFor(demoSchema);
    await seedTenantCore(db, {
      email: 'admin@demo-academy.local',
      fullName: 'Demo School Administrator',
      password: 'ChangeMe123!',
    });
    await db.$disconnect();
    console.log('Demo tenant ready: slug=demo-academy, admin=admin@demo-academy.local / ChangeMe123!');
  } else {
    console.log('Demo tenant already exists, skipping.');
  }

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await platformPrisma.$disconnect();
  });
