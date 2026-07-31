import type { PrismaClient } from '../../generated/tenant-client';

/** Separate numbering series from Finance's RCT-* receipts — keeps trip payments visibly distinct
 * on statements even though they use the same underlying Payment-recording pattern. */
export async function generateTripReceiptNumber(db: PrismaClient): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.tripPayment.count({ where: { receiptNumber: { startsWith: `TRP-${year}-` } } });
  return `TRP-${year}-${String(count + 1).padStart(4, '0')}`;
}
