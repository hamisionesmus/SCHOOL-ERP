import 'dotenv/config';
import { PrismaClient as PlatformPrismaClient } from '../generated/platform-client';
import { PrismaClient as TenantPrismaClient } from '../generated/tenant-client';

/**
 * One-time backfill: assigns Invoice.invoiceNumber to every invoice created before the field
 * existed (see invoice-number.util.ts). New invoices get one automatically going forward — this
 * script is only for pre-existing rows. Safe to re-run; skips invoices that already have a number.
 */
function tenantClientFor(schemaName: string) {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', schemaName);
  return new TenantPrismaClient({ datasources: { db: { url: url.toString() } } });
}

async function main() {
  const platformPrisma = new PlatformPrismaClient();
  const tenants = await platformPrisma.tenant.findMany({ where: { deletedAt: null } });

  let updated = 0;

  for (const tenant of tenants) {
    console.log(`\n=== ${tenant.slug} (${tenant.schemaName}) ===`);
    const db = tenantClientFor(tenant.schemaName);
    const invoices = await db.invoice.findMany({
      where: { invoiceNumber: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true },
    });

    const byYear = new Map<number, number>();
    for (const invoice of invoices) {
      const year = invoice.createdAt.getFullYear();
      const existingCount = await db.invoice.count({ where: { invoiceNumber: { startsWith: `INV-${year}-` } } });
      const next = (byYear.get(year) ?? existingCount) + 1;
      byYear.set(year, next);
      const invoiceNumber = `INV-${year}-${String(next).padStart(4, '0')}`;
      await db.invoice.update({ where: { id: invoice.id }, data: { invoiceNumber } });
      updated++;
      console.log(`  + ${invoiceNumber}`);
    }

    await db.$disconnect();
  }

  await platformPrisma.$disconnect();
  console.log(`\nDone. ${updated} invoice(s) backfilled.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
