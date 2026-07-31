import 'dotenv/config';
import { PrismaClient as PlatformPrismaClient } from '../generated/platform-client';
import { PrismaClient as TenantPrismaClient } from '../generated/tenant-client';

/**
 * One-off demo-data seed for "greenfield-academy" Phase 6 features: school branding (mission/
 * vision/motto), Super-Admin-set payment config, and a trip proposed by Peter Otieno (still
 * PROPOSED — left for live browser verification of the approve/register/pay flow). Idempotent.
 */
async function main() {
  const platformPrisma = new PlatformPrismaClient();
  const tenant = await platformPrisma.tenant.findUniqueOrThrow({ where: { slug: 'greenfield-academy' } });

  await platformPrisma.tenant.update({
    where: { id: tenant.id },
    data: {
      mission: 'To nurture confident, competent CBC learners equipped for life beyond the classroom.',
      vision: 'To be the leading CBC academy in Nairobi by 2030.',
      motto: 'Excellence Through Character',
      mpesaPaybill: '400200',
      bankName: 'Equity Bank',
      bankAccountName: 'Greenfield Academy',
      bankAccountNumber: '0123456789',
    },
  });
  await platformPrisma.$disconnect();

  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', tenant.schemaName);
  const db = new TenantPrismaClient({ datasources: { db: { url: url.toString() } } });

  const teacher = await db.user.findUniqueOrThrow({ where: { email: 'teacher@greenfield.ac.ke' } });
  const existingTrip = await db.trip.findFirst({ where: { title: { contains: 'Nairobi National Museum' } } });
  if (!existingTrip) {
    await db.trip.create({
      data: {
        title: 'Grade 4 Nairobi National Museum Trip',
        description: 'Educational visit tied to the CBC Social Studies unit on Kenyan heritage.',
        destination: 'Nairobi National Museum',
        tripDate: new Date('2026-09-20'),
        costPerStudent: 800,
        proposedByUserId: teacher.id,
      },
    });
  }

  console.log('School branding set: mission/vision/motto + payment config (M-Pesa paybill, bank details)');
  console.log('Trip proposed: "Grade 4 Nairobi National Museum Trip" by Peter Otieno (PROPOSED, awaiting approval)');
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
