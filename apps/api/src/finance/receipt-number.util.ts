import type { PrismaClient } from '../../generated/tenant-client';

/** Same sequential-per-year pattern as students/admission-number.util.ts. */
export async function generateReceiptNumber(db: PrismaClient): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.payment.count({ where: { receiptNumber: { startsWith: `RCT-${year}-` } } });
  return `RCT-${year}-${String(count + 1).padStart(4, '0')}`;
}
