import 'dotenv/config';
import { PrismaClient as PlatformPrismaClient } from '../generated/platform-client';
import { PrismaClient as TenantPrismaClient } from '../generated/tenant-client';

/**
 * One-off demo-data seed for "greenfield-academy": a Term 2 fee structure for Grade 4, an invoice for
 * John Mwangi, and a phone number on his guardian (Mary Mwangi) so the SMS stub has something
 * real-looking to log. Idempotent.
 */
async function main() {
  const platformPrisma = new PlatformPrismaClient();
  const tenant = await platformPrisma.tenant.findUniqueOrThrow({ where: { slug: 'greenfield-academy' } });
  await platformPrisma.$disconnect();

  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', tenant.schemaName);
  const db = new TenantPrismaClient({ datasources: { db: { url: url.toString() } } });

  await db.user.update({ where: { email: 'parent@greenfield.ac.ke' }, data: { phone: '254712345678' } });

  const gradeFour = await db.gradeLevel.findUniqueOrThrow({ where: { code: 'G4' } });
  const academicYear = await db.academicYear.findUniqueOrThrow({ where: { name: '2026' } });

  let feeStructure = await db.feeStructure.findFirst({
    where: { gradeLevelId: gradeFour.id, academicYearId: academicYear.id, term: 2 },
  });
  if (!feeStructure) {
    feeStructure = await db.feeStructure.create({
      data: {
        name: 'Grade 4 Term 2 Fees',
        gradeLevelId: gradeFour.id,
        academicYearId: academicYear.id,
        term: 2,
        amount: 15000,
      },
    });
  }

  const john = await db.student.findFirstOrThrow({ where: { firstName: 'John', lastName: 'Mwangi' } });
  const existingInvoice = await db.invoice.findFirst({
    where: { studentId: john.id, feeStructureId: feeStructure.id },
  });
  if (!existingInvoice) {
    await db.invoice.create({
      data: {
        studentId: john.id,
        feeStructureId: feeStructure.id,
        academicYearId: academicYear.id,
        term: 2,
        amount: feeStructure.amount,
        balance: feeStructure.amount,
        dueDate: new Date('2026-09-01'),
      },
    });
  }

  console.log('Fee structure ready: Grade 4 Term 2 Fees, KES 15,000');
  console.log('Invoice ready for John Mwangi (KES 15,000 outstanding)');
  console.log('Mary Mwangi phone set to 254712345678 for SMS demo');
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
