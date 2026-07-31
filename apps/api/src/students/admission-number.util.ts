import type { PrismaClient } from '../../generated/tenant-client';

/** Shared by direct student creation (StudentsService) and admissions admit (AdmissionsService). */
export async function generateAdmissionNumber(db: PrismaClient): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.student.count({ where: { admissionNumber: { startsWith: `ADM-${year}-` } } });
  return `ADM-${year}-${String(count + 1).padStart(4, '0')}`;
}
