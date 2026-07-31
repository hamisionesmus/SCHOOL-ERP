import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaClient as PlatformPrismaClient } from '../generated/platform-client';
import { PrismaClient as TenantPrismaClient } from '../generated/tenant-client';

/**
 * One-off demo-data seed for the "greenfield-academy" tenant used throughout Phase 1/2 manual
 * verification: an academic year, a class with an assigned Class Teacher, a Parent linked to the
 * existing "John Mwangi" student, so Attendance/Homework can be exercised end-to-end without manual
 * curl/UI setup. Idempotent (upserts) — safe to re-run.
 */
async function main() {
  const platformPrisma = new PlatformPrismaClient();
  const tenant = await platformPrisma.tenant.findUniqueOrThrow({ where: { slug: 'greenfield-academy' } });
  await platformPrisma.$disconnect();

  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', tenant.schemaName);
  const db = new TenantPrismaClient({ datasources: { db: { url: url.toString() } } });

  const academicYear = await db.academicYear.upsert({
    where: { name: '2026' },
    update: {},
    create: { name: '2026', startDate: new Date('2026-01-06'), endDate: new Date('2026-11-20'), isCurrent: true },
  });

  const gradeFour = await db.gradeLevel.findUniqueOrThrow({ where: { code: 'G4' } });

  const teacherPasswordHash = await bcrypt.hash('ChangeMe123!', 12);
  const teacher = await db.user.upsert({
    where: { email: 'teacher@greenfield.ac.ke' },
    update: {},
    create: { email: 'teacher@greenfield.ac.ke', fullName: 'Peter Otieno', passwordHash: teacherPasswordHash },
  });
  const classTeacherRole = await db.role.findUniqueOrThrow({ where: { name: 'Class Teacher' } });
  await db.userRole.upsert({
    where: { userId_roleId: { userId: teacher.id, roleId: classTeacherRole.id } },
    update: {},
    create: { userId: teacher.id, roleId: classTeacherRole.id },
  });

  const schoolClass = await db.schoolClass.upsert({
    where: { name_academicYearId: { name: 'Grade 4 Blue', academicYearId: academicYear.id } },
    update: { classTeacherId: teacher.id },
    create: {
      name: 'Grade 4 Blue',
      gradeLevelId: gradeFour.id,
      academicYearId: academicYear.id,
      classTeacherId: teacher.id,
    },
  });

  const john = await db.student.findFirst({ where: { firstName: 'John', lastName: 'Mwangi' } });
  if (john) {
    await db.student.update({ where: { id: john.id }, data: { currentClassId: schoolClass.id } });

    const parentPasswordHash = await bcrypt.hash('ChangeMe123!', 12);
    const parent = await db.user.upsert({
      where: { email: 'parent@greenfield.ac.ke' },
      update: {},
      create: { email: 'parent@greenfield.ac.ke', fullName: 'Mary Mwangi', passwordHash: parentPasswordHash },
    });
    const parentRole = await db.role.findUniqueOrThrow({ where: { name: 'Parent' } });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: parent.id, roleId: parentRole.id } },
      update: {},
      create: { userId: parent.id, roleId: parentRole.id },
    });
    await db.guardianLink.upsert({
      where: { studentId_guardianUserId: { studentId: john.id, guardianUserId: parent.id } },
      update: {},
      create: { studentId: john.id, guardianUserId: parent.id, relationship: 'MOTHER', isPrimaryContact: true },
    });
    console.log('Parent ready: parent@greenfield.ac.ke / ChangeMe123! (guardian of John Mwangi)');
  } else {
    console.log('Student "John Mwangi" not found — skipping parent linking.');
  }

  console.log('Class Teacher ready: teacher@greenfield.ac.ke / ChangeMe123! (assigned to Grade 4 Blue)');
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
