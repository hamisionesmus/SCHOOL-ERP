import PDFDocument from 'pdfkit';

function kes(n: number) {
  return `KES ${n.toLocaleString()}`;
}

export interface PlatformInvoicePdfInput {
  schoolName: string;
  invoiceNumber: string;
  billingCycle: string;
  periodStart: Date;
  periodEnd: Date;
  amount: number;
  dueDate: Date;
  status: string;
  payments: { receiptNumber: string; amount: number; method: string; createdAt: Date }[];
  generatedAt: Date;
}

const STATUS_COLOR: Record<string, string> = {
  PAID: '#16a34a',
  PENDING: '#d97706',
  OVERDUE: '#dc2626',
  CANCELLED: '#64748b',
};

/** Renders a platform subscription invoice/receipt as a PDF buffer — same pure-function pattern as
 * report-card-pdf.util.ts / payslip-pdf.util.ts. Doubles as a receipt once payments exist. */
export function renderPlatformInvoicePdf(input: PlatformInvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).fillColor('#0f172a').text('School ERP — Platform Billing', 50, 50);
    doc.fontSize(10).fillColor('#64748b').text(`Invoice ${input.invoiceNumber}`, 50, 74);
    doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#e2e8f0').stroke();

    doc.fontSize(12).fillColor('#0f172a').text(input.schoolName, 50, 115);
    doc
      .fontSize(10)
      .fillColor('#475569')
      .text(`${input.billingCycle} subscription — ${input.periodStart.toLocaleDateString()} to ${input.periodEnd.toLocaleDateString()}`, 50, 133)
      .text(`Due: ${input.dueDate.toLocaleDateString()}`, 50, 149);

    doc
      .fontSize(11)
      .fillColor(STATUS_COLOR[input.status] ?? '#334155')
      .text(input.status, 400, 115, { width: 145, align: 'right' });

    let y = 190;
    doc.fontSize(14).fillColor('#0f172a').text('Amount Due', 50, y);
    doc.fontSize(14).fillColor('#0f172a').text(kes(input.amount), 400, y, { width: 145, align: 'right' });
    y += 30;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
    y += 20;

    if (input.payments.length > 0) {
      doc.fontSize(11).fillColor('#0f172a').text('Payments Received', 50, y);
      y += 20;
      doc.fontSize(9).fillColor('#64748b');
      doc.text('Receipt', 50, y);
      doc.text('Method', 220, y);
      doc.text('Date', 340, y);
      doc.text('Amount', 460, y, { width: 85, align: 'right' });
      y += 14;
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
      y += 8;
      for (const p of input.payments) {
        doc.fontSize(9).fillColor('#334155');
        doc.text(p.receiptNumber, 50, y);
        doc.text(p.method, 220, y);
        doc.text(p.createdAt.toLocaleDateString(), 340, y);
        doc.fillColor('#16a34a').text(kes(p.amount), 460, y, { width: 85, align: 'right' });
        y += 18;
      }
    } else {
      doc.fontSize(9).fillColor('#94a3b8').text('No payments recorded yet.', 50, y);
    }

    doc
      .fontSize(7)
      .fillColor('#cbd5e1')
      .text(`Generated ${input.generatedAt.toLocaleString()}`, 50, 780, { align: 'center', width: 495 });

    doc.end();
  });
}
