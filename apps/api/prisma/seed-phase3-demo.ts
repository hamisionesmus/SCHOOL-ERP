import 'dotenv/config';
import { PrismaClient as PlatformPrismaClient } from '../generated/platform-client';
import { PrismaClient as TenantPrismaClient } from '../generated/tenant-client';

/**
 * One-off demo-data seed for "greenfield-academy": subjects, a subject assignment (Peter Otieno
 * teaches Mathematics for Grade 4 Blue — the same class he's already Class Teacher of, from
 * seed-phase2-demo.ts), and a CAT exam with one exam-subject ready for marks entry. Idempotent.
 */
async function main() {
  const platformPrisma = new PlatformPrismaClient();
  const tenant = await platformPrisma.tenant.findUniqueOrThrow({ where: { slug: 'greenfield-academy' } });
  await platformPrisma.$disconnect();

  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', tenant.schemaName);
  const db = new TenantPrismaClient({ datasources: { db: { url: url.toString() } } });

  const math = await db.subject.upsert({
    where: { code: 'MATH' },
    update: {},
    create: { name: 'Mathematics', code: 'MATH' },
  });
  await db.subject.upsert({ where: { code: 'ENG' }, update: {}, create: { name: 'English', code: 'ENG' } });
  await db.subject.upsert({ where: { code: 'KISW' }, update: {}, create: { name: 'Kiswahili', code: 'KISW' } });

  const teacher = await db.user.findUniqueOrThrow({ where: { email: 'teacher@greenfield.ac.ke' } });
  const schoolClass = await db.schoolClass.findFirstOrThrow({ where: { name: 'Grade 4 Blue' } });

  const existingAssignment = await db.subjectAssignment.findFirst({
    where: { subjectId: math.id, classId: schoolClass.id, teacherId: teacher.id },
  });
  if (!existingAssignment) {
    await db.subjectAssignment.create({
      data: { subjectId: math.id, classId: schoolClass.id, teacherId: teacher.id },
    });
  }

  const academicYear = await db.academicYear.findUniqueOrThrow({ where: { name: '2026' } });
  let exam = await db.exam.findFirst({ where: { name: 'Term 2 CAT 1' } });
  if (!exam) {
    exam = await db.exam.create({
      data: {
        name: 'Term 2 CAT 1',
        examType: 'CAT',
        academicYearId: academicYear.id,
        term: 2,
        startDate: new Date('2026-08-10'),
        endDate: new Date('2026-08-14'),
      },
    });
  }

  const existingExamSubject = await db.examSubject.findFirst({
    where: { examId: exam.id, subjectId: math.id, classId: schoolClass.id },
  });
  if (!existingExamSubject) {
    await db.examSubject.create({
      data: { examId: exam.id, subjectId: math.id, classId: schoolClass.id, maxScore: 100, scoringMode: 'NUMERIC' },
    });
  }

  console.log('Subjects seeded: Mathematics, English, Kiswahili');
  console.log('Peter Otieno assigned to teach Mathematics for Grade 4 Blue');
  console.log('Exam ready: "Term 2 CAT 1" — Mathematics / Grade 4 Blue exam-subject in DRAFT status');
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
