import 'dotenv/config';
import { PrismaClient as PlatformPrismaClient } from '../generated/platform-client';
import { PrismaClient as TenantPrismaClient } from '../generated/tenant-client';

/**
 * One-off demo-data seed for "greenfield-academy" Phase 5 modules: a library book, a transport
 * route+vehicle, an inventory item, a medical alert, and a leave request for Peter Otieno (the
 * demo Class Teacher). Discipline cases are deliberately left for live browser verification since
 * they trigger a real SMS side effect worth watching happen. Idempotent.
 */
async function main() {
  const platformPrisma = new PlatformPrismaClient();
  const tenant = await platformPrisma.tenant.findUniqueOrThrow({ where: { slug: 'greenfield-academy' } });
  await platformPrisma.$disconnect();

  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', tenant.schemaName);
  const db = new TenantPrismaClient({ datasources: { db: { url: url.toString() } } });

  const book = await db.book.upsert({
    where: { isbn: '9789966000001' },
    update: {},
    create: {
      title: 'CBC Mathematics Grade 4',
      author: 'Kenya Institute of Curriculum Development',
      isbn: '9789966000001',
      totalCopies: 5,
      availableCopies: 5,
    },
  });

  const teacher = await db.user.findUniqueOrThrow({ where: { email: 'teacher@greenfield.ac.ke' } });
  const vehicle = await db.vehicle.upsert({
    where: { plateNumber: 'KDA 123X' },
    update: {},
    create: { plateNumber: 'KDA 123X', capacity: 33, driverId: teacher.id },
  });

  let route = await db.route.findFirst({ where: { name: 'Route A - Kilimani' } });
  if (!route) {
    route = await db.route.create({
      data: { name: 'Route A - Kilimani', description: 'Kilimani -> School via Ngong Rd', vehicleId: vehicle.id },
    });
  }

  const john = await db.student.findFirstOrThrow({ where: { firstName: 'John', lastName: 'Mwangi' } });
  await db.transportAssignment.upsert({
    where: { studentId: john.id },
    update: { routeId: route.id },
    create: { studentId: john.id, routeId: route.id },
  });

  const item = await db.inventoryItem.findFirst({ where: { name: 'Exercise books' } });
  if (!item) {
    await db.inventoryItem.create({
      data: { name: 'Exercise books', category: 'Stationery', quantity: 200, unit: 'pcs', reorderLevel: 50 },
    });
  }

  const existingAlert = await db.medicalAlert.findFirst({ where: { studentId: john.id } });
  if (!existingAlert) {
    await db.medicalAlert.create({
      data: { studentId: john.id, condition: 'Peanut allergy', severity: 'HIGH', notes: 'Carries EpiPen' },
    });
  }

  const existingLeave = await db.leaveRequest.findFirst({ where: { requestedByUserId: teacher.id } });
  if (!existingLeave) {
    await db.leaveRequest.create({
      data: {
        requestedByUserId: teacher.id,
        leaveType: 'Annual',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-05'),
        reason: 'Family trip',
      },
    });
  }

  console.log('Library: "CBC Mathematics Grade 4" (5 copies)');
  console.log('Transport: Route A - Kilimani, vehicle KDA 123X (driver: Peter Otieno), John Mwangi assigned');
  console.log('Inventory: Exercise books, 200 pcs in stock');
  console.log('Health: Peanut allergy alert on John Mwangi');
  console.log('HR: Peter Otieno has a pending Annual leave request');
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
