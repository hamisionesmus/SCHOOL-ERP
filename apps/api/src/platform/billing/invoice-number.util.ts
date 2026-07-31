import type { PrismaClient } from '../../../generated/platform-client';

/** Same sequential-per-year pattern as the tenant-side receipt/admission-number utils. */
export async function generateInvoiceNumber(db: PrismaClient): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.platformInvoice.count({ where: { invoiceNumber: { startsWith: `INV-${year}-` } } });
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function generatePlatformReceiptNumber(db: PrismaClient): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.platformPayment.count({ where: { receiptNumber: { startsWith: `PRCT-${year}-` } } });
  return `PRCT-${year}-${String(count + 1).padStart(4, '0')}`;
}
