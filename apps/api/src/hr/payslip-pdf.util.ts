import PDFDocument from 'pdfkit';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface PayslipPdfInput {
  school: { name: string };
  staff: { fullName: string; email: string };
  periodMonth: number;
  periodYear: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  notes: string | null;
  generatedAt: Date;
}

function kes(n: number) {
  return `KES ${n.toLocaleString()}`;
}

/** Renders a single-page payslip as a PDF buffer. Pure function, same pattern as
 * report-card-pdf.util.ts's renderReportCardPdf(). */
export function renderPayslipPdf(input: PayslipPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).fillColor('#0f172a').text(input.school.name, 50, 50);
    doc.fontSize(10).fillColor('#64748b').text('Staff Payslip', 50, 74);
    doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#e2e8f0').stroke();

    doc.fontSize(12).fillColor('#0f172a').text(input.staff.fullName, 50, 115);
    doc.fontSize(10).fillColor('#475569').text(input.staff.email, 50, 133);
    doc
      .fontSize(10)
      .fillColor('#475569')
      .text(`Period: ${MONTH_NAMES[input.periodMonth - 1]} ${input.periodYear}`, 50, 151);

    let y = 190;
    const rows: [string, string][] = [
      ['Gross Pay', kes(input.grossPay)],
      ['Deductions', `- ${kes(input.deductions)}`],
      ['Net Pay', kes(input.netPay)],
    ];
    for (const [label, value] of rows) {
      const isNet = label === 'Net Pay';
      doc.fontSize(isNet ? 12 : 10).fillColor(isNet ? '#0f172a' : '#475569').text(label, 50, y);
      doc
        .fontSize(isNet ? 12 : 10)
        .fillColor(isNet ? '#16a34a' : '#334155')
        .text(value, 400, y, { width: 145, align: 'right' });
      y += isNet ? 26 : 22;
      if (isNet) {
        doc.moveTo(50, y - 8).lineTo(545, y - 8).strokeColor('#e2e8f0').stroke();
      }
    }

    if (input.notes) {
      y += 20;
      doc.fontSize(9).fillColor('#64748b').text(`Notes: ${input.notes}`, 50, y, { width: 495 });
    }

    doc
      .fontSize(7)
      .fillColor('#cbd5e1')
      .text(`Generated ${input.generatedAt.toLocaleString()}`, 50, 780, { align: 'center', width: 495 });

    doc.end();
  });
}
