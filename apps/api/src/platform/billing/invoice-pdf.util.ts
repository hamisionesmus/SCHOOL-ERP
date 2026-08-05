import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function kes(n: number) {
  return `KES ${n.toLocaleString()}`;
}

export function resolveUploadPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const path = join(process.cwd(), url.replace(/^\/+/, ''));
  return existsSync(path) ? path : null;
}

export interface PlatformInvoicePdfInput {
  companyName: string;
  logoUrl: string | null;
  schoolName: string;
  schoolAddressLines: string[];
  invoiceNumber: string;
  lineDescription: string;
  invoiceDate: Date;
  dueDate: Date;
  amount: number;
  status: string;
  payment: {
    paybillNumber: string | null;
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNumber: string | null;
  };
  contact: {
    supportPhone: string | null;
    supportWebsite: string | null;
    billingEmail: string | null;
  };
  payments: { receiptNumber: string; amount: number; method: string; createdAt: Date }[];
  generatedAt: Date;
}

const COMPANY_NAME = 'Hamzone Technologies';

/** Assembles PlatformInvoicePdfInput from a real invoice + tenant + the platform's own payment
 * config/branding — shared by BillingService (Super Admin side) and SettingsService (a School
 * Administrator downloading their own school's invoice) so the two PDFs never drift apart. */
export function buildPlatformInvoicePdfInput(
  invoice: {
    invoiceNumber: string;
    billingCycle: string;
    periodStart: Date;
    periodEnd: Date;
    amount: number;
    dueDate: Date;
    status: string;
    createdAt: Date;
    payments: { receiptNumber: string; amount: number; method: string; createdAt: Date }[];
  },
  tenant: { name: string; address: string | null; town: string | null; county: string | null },
  settings: {
    loginLogoUrl: string | null;
    paybillEnabled: boolean;
    paybillNumber: string | null;
    bankTransferEnabled: boolean;
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNumber: string | null;
    supportPhone?: string | null;
    supportWebsite?: string | null;
    billingEmail?: string | null;
  },
): PlatformInvoicePdfInput {
  const addressLines = [tenant.address, [tenant.town, tenant.county].filter(Boolean).join(', ') || null, 'Kenya'].filter(
    (line): line is string => !!line,
  );
  return {
    companyName: COMPANY_NAME,
    logoUrl: settings.loginLogoUrl,
    schoolName: tenant.name,
    schoolAddressLines: addressLines,
    invoiceNumber: invoice.invoiceNumber,
    lineDescription: `${invoice.billingCycle[0]}${invoice.billingCycle.slice(1).toLowerCase()} subscription — ${invoice.periodStart.toLocaleDateString()} to ${invoice.periodEnd.toLocaleDateString()}`,
    invoiceDate: invoice.createdAt,
    dueDate: invoice.dueDate,
    amount: invoice.amount,
    status: invoice.status,
    payment: {
      paybillNumber: settings.paybillEnabled ? settings.paybillNumber : null,
      bankName: settings.bankTransferEnabled ? settings.bankName : null,
      bankAccountName: settings.bankAccountName,
      bankAccountNumber: settings.bankAccountNumber,
    },
    contact: {
      supportPhone: settings.supportPhone ?? null,
      supportWebsite: settings.supportWebsite ?? null,
      billingEmail: settings.billingEmail ?? null,
    },
    payments: invoice.payments,
    generatedAt: new Date(),
  };
}

const STATUS_COLOR: Record<string, string> = {
  PAID: '#16a34a',
  PENDING: '#d97706',
  OVERDUE: '#dc2626',
  CANCELLED: '#64748b',
};

const STATUS_LABEL: Record<string, string> = {
  PAID: 'PAID',
  PENDING: 'UNPAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
};

export function fmtDate(d: Date) {
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Diagonal corner badge (Truehost-style) showing PAID/UNPAID/OVERDUE/CANCELLED — rotated 45°
 * around a pivot tucked into the top-right corner so it never collides with the Payment Details
 * block below it, regardless of status-label length. */
function drawStatusRibbon(doc: PDFKit.PDFDocument, status: string) {
  const color = STATUS_COLOR[status] ?? '#64748b';
  const label = STATUS_LABEL[status] ?? status;
  const cx = doc.page.width - 38;
  const cy = 38;

  doc.save();
  doc.rotate(45, { origin: [cx, cy] });
  doc.rect(cx - 105, cy - 13, 210, 26).fill(color);
  doc.restore();

  doc.save();
  doc.rotate(45, { origin: [cx, cy] });
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#ffffff')
    .text(label, cx - 105, cy - 3.5, { width: 210, align: 'center', characterSpacing: 1.2 });
  doc.restore();
}

export function band(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, color: string) {
  doc.rect(x, y, width, height).fill(color);
}

/** Renders a platform subscription invoice/receipt as a PDF buffer — Truehost-inspired layout
 * (diagonal status ribbon, right-aligned payment instructions, banded invoice/line-item/transaction
 * tables) requested to replace the earlier plain version. Same pure-function pattern as
 * report-card-pdf.util.ts / payslip-pdf.util.ts. Doubles as a receipt once payments exist. */
export function renderPlatformInvoicePdf(input: PlatformInvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 50;
    const right = 545;
    const contentWidth = right - left;

    // ---- Header: logo + company name (left) ----
    const logoPath = resolveUploadPath(input.logoUrl);
    if (logoPath) {
      doc.image(logoPath, left, 45, { fit: [50, 50] });
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text(input.companyName, left + 60, 58);
    } else {
      doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text(input.companyName, left, 55);
    }

    drawStatusRibbon(doc, input.status);

    // ---- Payment Details (right-aligned) ----
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
      ry += 12;
      doc.text(`Reference: ${input.invoiceNumber}`, rx, ry, { width: rw, align: 'right' });
      ry += 16;
    }
    if (!input.payment.paybillNumber && !input.payment.bankName) {
      const fallbackContact = input.contact.billingEmail ?? 'the school administrator';
      doc.text(`Contact ${fallbackContact} for payment`, rx, ry, { width: rw, align: 'right' });
      ry += 11;
      doc.text('instructions.', rx, ry, { width: rw, align: 'right' });
      ry += 16;
    }

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#94a3b8')
      .text('M-Pesa payments confirm within minutes; bank', rx, ry, { width: rw, align: 'right' });
    ry += 10;
    doc.text('transfers may take a business day.', rx, ry, { width: rw, align: 'right' });
    ry += 14;

    // Contact block anchored at a fixed minimum offset (not floating right after whatever payment
    // blocks preceded it) so it never drifts or overlaps — sourced from PlatformSettings, never
    // hardcoded.
    ry = Math.max(ry, 118 + 20 + 44 + 24);
    const contactLine = [input.contact.supportPhone, input.contact.supportWebsite].filter((p): p is string => !!p).join(' · ');
    if (contactLine) {
      doc.text(contactLine, rx, ry, { width: rw, align: 'right' });
      ry += 11;
    }
    if (input.contact.billingEmail) {
      doc.text(input.contact.billingEmail, rx, ry, { width: rw, align: 'right' });
      ry += 11;
    }

    // ---- Grey banner: invoice number + dates ----
    let y = Math.max(ry + 14, 210);
    band(doc, left, y, contentWidth, 62, '#f1f5f9');
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text(`Invoice #${input.invoiceNumber}`, left + 14, y + 10);
    doc.font('Helvetica').fontSize(9).fillColor('#475569');
    doc.text(`Invoice Date: ${fmtDate(input.invoiceDate)}`, left + 14, y + 34);
    doc.text(`Due Date: ${fmtDate(input.dueDate)}`, left + 14, y + 47);
    y += 62 + 24;

    // ---- Invoiced To ----
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text('Invoiced To', left, y);
    y += 15;
    doc.font('Helvetica').fontSize(9.5).fillColor('#334155');
    doc.text(input.schoolName, left, y);
    y += 13;
    for (const line of input.schoolAddressLines) {
      doc.text(line, left, y);
      y += 13;
    }
    y += 15;

    // ---- Line items table ----
    const col2 = right - 110;
    band(doc, left, y, contentWidth, 22, '#e2e8f0');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155');
    doc.text('Description', left + 10, y + 6);
    doc.text('Amount', col2, y + 6, { width: right - col2 - 10, align: 'right' });
    y += 22;

    band(doc, left, y, contentWidth, 24, '#f8fafc');
    doc.font('Helvetica').fontSize(9.5).fillColor('#334155');
    doc.text(input.lineDescription, left + 10, y + 7, { width: col2 - left - 20 });
    doc.text(kes(input.amount), col2, y + 7, { width: right - col2 - 10, align: 'right' });
    y += 24;

    band(doc, left, y, contentWidth, 26, '#e2e8f0');
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a');
    doc.text('Total', left + 10, y + 7);
    doc.text(kes(input.amount), col2, y + 7, { width: right - col2 - 10, align: 'right' });
    y += 26 + 28;

    // ---- Transactions ----
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Transactions', left, y);
    y += 18;

    const c1 = left;
    const c2 = left + 110;
    const c3 = left + 260;
    const c4 = right - 90;
    band(doc, left, y, contentWidth, 22, '#e2e8f0');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#334155');
    doc.text('Date', c1 + 10, y + 6);
    doc.text('Method', c2, y + 6);
    doc.text('Receipt', c3, y + 6);
    doc.text('Amount', c4, y + 6, { width: right - c4 - 10, align: 'right' });
    y += 22;

    if (input.payments.length === 0) {
      band(doc, left, y, contentWidth, 24, '#f8fafc');
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#94a3b8')
        .text('No related transactions found', left, y + 7, { width: contentWidth, align: 'center' });
      y += 24;
    } else {
      for (const p of input.payments) {
        band(doc, left, y, contentWidth, 22, '#f8fafc');
        doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
        doc.text(fmtDate(p.createdAt), c1 + 10, y + 6);
        doc.text(p.method, c2, y + 6);
        doc.text(p.receiptNumber, c3, y + 6);
        doc.fillColor('#16a34a').text(kes(p.amount), c4, y + 6, { width: right - c4 - 10, align: 'right' });
        y += 22;
      }
    }

    const totalPaid = input.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = input.amount - totalPaid;
    band(doc, left, y, contentWidth, 24, '#e2e8f0');
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a');
    doc.text('Balance', c1 + 10, y + 7);
    doc.fillColor(balance > 0 ? '#dc2626' : '#16a34a').text(kes(balance), c4, y + 7, { width: right - c4 - 10, align: 'right' });

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
