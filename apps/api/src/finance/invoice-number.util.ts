import type { PrismaClient } from '../../generated/tenant-client';

/** Same sequential-per-year pattern as receipt-number.util.ts. */
export async function generateInvoiceNumber(db: PrismaClient): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.invoice.count({ where: { invoiceNumber: { startsWith: `INV-${year}-` } } });
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
}
