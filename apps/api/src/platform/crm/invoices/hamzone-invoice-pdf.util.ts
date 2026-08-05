import PDFDocument from 'pdfkit';
import { band, fmtDate, kes, resolveUploadPath } from '../../billing/invoice-pdf.util';

export interface HamzoneInvoicePdfInput {
  logoUrl: string | null;
  clientName: string;
  clientContactLines: string[];
  invoiceNumber: string;
  productLine: string;
  description: string;
  invoiceDate: Date;
  dueDate: Date;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  status: string;
  paidAt: Date | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  payment: {
    paybillNumber: string | null;
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNumber: string | null;
  };
  generatedAt: Date;
}

const STATUS_COLOR: Record<string, string> = {
  PAID: '#16a34a',
  PENDING: '#d97706',
  OVERDUE: '#dc2626',
  CANCELLED: '#64748b',
};

function drawStatusRibbon(doc: PDFKit.PDFDocument, status: string) {
  const color = STATUS_COLOR[status] ?? '#64748b';
  const label = status === 'PENDING' ? 'UNPAID' : status;
  const cx = doc.page.width - 38;
  const cy = 38;

  doc.save();
  doc.rotate(45, { origin: [cx, cy] });
  doc.rect(cx - 105, cy - 13, 210, 26).fill(color);
  doc.restore();

  doc.save();
  doc.rotate(45, { origin: [cx, cy] });
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text(label, cx - 105, cy - 3.5, { width: 210, align: 'center', characterSpacing: 1.2 });
  doc.restore();
}

/** Renders a Hamzone Technologies company invoice (any product line — training, websites, SACCO
 * systems, hospital systems, or the school ERP itself) as a PDF buffer. Visually mirrors the
 * platform subscription invoice (same header/ribbon/banner conventions, see invoice-pdf.util.ts)
 * but with an explicit VAT breakdown instead of a running transactions table, since these are
 * settled with a single "mark paid" action rather than partial M-Pesa/bank payments over time. */
export function renderHamzoneInvoicePdf(input: HamzoneInvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 50;
    const right = 545;
    const contentWidth = right - left;

    const logoPath = resolveUploadPath(input.logoUrl);
    if (logoPath) {
      doc.image(logoPath, left, 45, { fit: [50, 50] });
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text('Hamzone Technologies', left + 60, 58);
    } else {
      doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text('Hamzone Technologies', left, 55);
    }
    doc.font('Helvetica').fontSize(9).fillColor('#94a3b8').text(input.productLine.replace(/_/g, ' '), left + 60, 80);

    drawStatusRibbon(doc, input.status);

    let ry = 118;
    const rx = 320;
    const rw = right - rx;
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Payment Details', rx, ry, { width: rw, align: 'right' });
    ry += 20;
    doc.font('Helvetica').fontSize(9).fillColor('#475569');
    if (input.payment.paybillNumber) {
      doc.text('Lipa na M-Pesa', rx, ry, { width: rw, align: 'right' });
      ry += 12;
      doc.text(`Paybill: ${input.payment.paybillNumber}`, rx, ry, { width: rw, align: 'right' });
      ry += 12;
      doc.text(`Account: ${input.invoiceNumber}`, rx, ry, { width: rw, align: 'right' });
      ry += 16;
    }
    if (input.payment.bankName) {
      doc.text(`Bank: ${input.payment.bankName}`, rx, ry, { width: rw, align: 'right' });
      ry += 12;
      doc.text(`Account Name: ${input.payment.bankAccountName ?? ''}`, rx, ry, { width: rw, align: 'right' });
      ry += 12;
      doc.text(`Account No: ${input.payment.bankAccountNumber ?? ''}`, rx, ry, { width: rw, align: 'right' });
      ry += 16;
    }
    doc.text('+254 711 562526 · hamzonetechnologies.com', rx, ry, { width: rw, align: 'right' });
    ry += 14;

    let y = Math.max(ry + 14, 210);
    band(doc, left, y, contentWidth, 62, '#f1f5f9');
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text(`Invoice #${input.invoiceNumber}`, left + 14, y + 10);
    doc.font('Helvetica').fontSize(9).fillColor('#475569');
    doc.text(`Invoice Date: ${fmtDate(input.invoiceDate)}`, left + 14, y + 34);
    doc.text(`Due Date: ${fmtDate(input.dueDate)}`, left + 14, y + 47);
    y += 62 + 24;

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text('Invoiced To', left, y);
    y += 15;
    doc.font('Helvetica').fontSize(9.5).fillColor('#334155');
    doc.text(input.clientName, left, y);
    y += 13;
    for (const line of input.clientContactLines) {
      doc.text(line, left, y);
      y += 13;
    }
    y += 15;

    const col2 = right - 110;
    band(doc, left, y, contentWidth, 22, '#e2e8f0');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155');
    doc.text('Description', left + 10, y + 6);
    doc.text('Amount', col2, y + 6, { width: right - col2 - 10, align: 'right' });
    y += 22;

    band(doc, left, y, contentWidth, 24, '#f8fafc');
    doc.font('Helvetica').fontSize(9.5).fillColor('#334155');
    doc.text(input.description, left + 10, y + 7, { width: col2 - left - 20 });
    doc.text(kes(input.subtotal), col2, y + 7, { width: right - col2 - 10, align: 'right' });
    y += 24;

    band(doc, left, y, contentWidth, 22, '#f8fafc');
    doc.font('Helvetica').fontSize(9.5).fillColor('#334155');
    doc.text(`VAT (${input.vatRate}%)`, left + 10, y + 6);
    doc.text(kes(input.vatAmount), col2, y + 6, { width: right - col2 - 10, align: 'right' });
    y += 22;

    band(doc, left, y, contentWidth, 26, '#e2e8f0');
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a');
    doc.text('Total', left + 10, y + 7);
    doc.text(kes(input.total), col2, y + 7, { width: right - col2 - 10, align: 'right' });
    y += 26 + 24;

    if (input.status === 'PAID' && input.paidAt) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#16a34a').text('Payment Received', left, y);
      y += 15;
      doc.font('Helvetica').fontSize(9).fillColor('#475569');
      doc.text(`Paid on ${fmtDate(input.paidAt)}${input.paymentMethod ? ` via ${input.paymentMethod}` : ''}`, left, y);
      y += 12;
      if (input.paymentReference) {
        doc.text(`Reference: ${input.paymentReference}`, left, y);
      }
    }

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#94a3b8')
      .text('This is an electronically generated invoice and does not require a signature.', left, 766, {
        width: contentWidth,
        align: 'center',
      });
    doc.text(`PDF generated on ${fmtDate(input.generatedAt)}`, left, 780, { width: contentWidth, align: 'center' });

    doc.end();
  });
}
