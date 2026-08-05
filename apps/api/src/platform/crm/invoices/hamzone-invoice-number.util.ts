import type { PrismaClient } from '../../../../generated/platform-client';

/** Same sequential-per-year pattern as PlatformInvoice's own generator (invoice-number.util.ts) —
 * a distinct "HZ-" prefix keeps the two invoice series visually and numerically non-overlapping. */
export async function generateHamzoneInvoiceNumber(db: PrismaClient): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.hamzoneInvoice.count({ where: { invoiceNumber: { startsWith: `HZ-${year}-` } } });
  return `HZ-${year}-${String(count + 1).padStart(4, '0')}`;
}
