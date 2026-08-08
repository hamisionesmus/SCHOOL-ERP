import 'dotenv/config';
import { PrismaClient as PlatformPrismaClient } from '../generated/platform-client';

/**
 * One-time backfill: assigns HamzoneTrainee.traineeNumber to every trainee roster row created
 * before the field existed (see trainee-number.util.ts). New trainees get one automatically going
 * forward — this script is only for pre-existing rows. Safe to re-run; skips trainees that already
 * have a number.
 */
async function main() {
  const platformPrisma = new PlatformPrismaClient();
  const trainees = await platformPrisma.hamzoneTrainee.findMany({
    where: { traineeNumber: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true, fullName: true },
  });

  let updated = 0;
  const byYear = new Map<number, number>();

  for (const trainee of trainees) {
    const year = trainee.createdAt.getFullYear();
    const existingCount = await platformPrisma.hamzoneTrainee.count({
      where: { traineeNumber: { startsWith: `TRN-${year}-` } },
    });
    const next = (byYear.get(year) ?? existingCount) + 1;
    byYear.set(year, next);
    const traineeNumber = `TRN-${year}-${String(next).padStart(4, '0')}`;
    await platformPrisma.hamzoneTrainee.update({ where: { id: trainee.id }, data: { traineeNumber } });
    updated++;
    console.log(`  + ${traineeNumber} (${trainee.fullName})`);
  }

  await platformPrisma.$disconnect();
  console.log(`\nDone. ${updated} trainee(s) backfilled.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
