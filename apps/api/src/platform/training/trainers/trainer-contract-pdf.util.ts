import PDFDocument from 'pdfkit';
import { band, fmtDate, kes, resolveUploadPath } from '../../billing/invoice-pdf.util';

export interface TrainerContractPdfInput {
  logoUrl: string | null;
  trainerName: string;
  trainerEmail: string;
  trainerPhone: string | null;
  track: string | null;
  centerName: string | null;
  monthlySalaryKes: number | null;
  contractStartDate: Date | null;
  contractEndDate: Date | null;
  generatedAt: Date;
}

/** Auto-generated employment contract for a trainer, regenerated whenever their profile's contract
 * terms change (see HamzoneTrainerProfile's schema doc comment) — same visual identity as the
 * platform/Hamzone invoices (logo, band headers), but a plain letter body rather than a table. */
export function renderTrainerContractPdf(input: TrainerContractPdfInput): Promise<Buffer> {
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

    let y = 130;
    band(doc, left, y, contentWidth, 34, '#f1f5f9');
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text('Trainer Engagement Contract', left + 14, y + 9);
    y += 34 + 24;

    doc.font('Helvetica').fontSize(10).fillColor('#334155');
    const line = (label: string, value: string) => {
      doc.font('Helvetica-Bold').text(`${label}: `, left, y, { continued: true });
      doc.font('Helvetica').text(value);
      y += 18;
    };

    line('Trainer', input.trainerName);
    line('Email', input.trainerEmail);
    if (input.trainerPhone) line('Phone', input.trainerPhone);
    if (input.track) line('Track', input.track.replace(/_/g, ' '));
    if (input.centerName) line('Assigned Center', input.centerName);
    if (input.monthlySalaryKes != null) line('Monthly Salary', kes(input.monthlySalaryKes));
    if (input.contractStartDate) line('Contract Start', fmtDate(input.contractStartDate));
    if (input.contractEndDate) line('Contract End', fmtDate(input.contractEndDate));

    y += 20;
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor('#475569')
      .text(
        'This letter confirms the engagement terms above between Hamzone Technologies and the named trainer, covering the ' +
          'training track and center indicated, for the contract period stated. Compensation is payable monthly as stated. ' +
          'Either party may raise concerns about the terms of this engagement through the usual communication channels.',
        left,
        y,
        { width: contentWidth, align: 'left', lineGap: 3 },
      );

    y += 90;
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text('_______________________', left, y);
    doc.text('_______________________', left + 260, y);
    y += 14;
    doc.font('Helvetica').fontSize(8.5).fillColor('#64748b').text('Hamzone Technologies', left, y);
    doc.text(input.trainerName, left + 260, y);

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#94a3b8')
      .text('This is an electronically generated document.', left, 766, { width: contentWidth, align: 'center' });
    doc.text(`Generated on ${fmtDate(input.generatedAt)}`, left, 780, { width: contentWidth, align: 'center' });

    doc.end();
  });
}
