import type { PrismaClient } from '../../../../generated/platform-client';

/** Same sequential-per-year pattern as the tenant-side receipt/admission-number utils. */
export async function generateTraineeNumber(db: PrismaClient): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.hamzoneTrainee.count({ where: { traineeNumber: { startsWith: `TRN-${year}-` } } });
  return `TRN-${year}-${String(count + 1).padStart(4, '0')}`;
}
