import PDFDocument from 'pdfkit';
import { band, fmtDate } from '../../billing/invoice-pdf.util';

export interface DailyRegisterPdfInput {
  programTitle: string;
  trainerName: string;
  centerName: string | null;
  date: Date;
  hadTrainingToday: boolean;
  noTrainingReason: string | null;
  traineesPresent: number;
  traineesTotal: number;
  topicsCovered: string | null;
  notes: string | null;
  generatedAt: Date;
}

/** A trainer's daily attendance + coverage log as a downloadable PDF — see HamzoneDailyRegister's
 * schema doc comment. Single-page, simple letter layout (no invoice-style tables needed here). */
export function renderDailyRegisterPdf(input: DailyRegisterPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 50;
    const right = 545;
    const contentWidth = right - left;

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text('Hamzone Technologies', left, 55);
    doc.font('Helvetica').fontSize(9).fillColor('#94a3b8').text('Daily Training Register', left, 80);

    let y = 120;
    band(doc, left, y, contentWidth, 34, '#f1f5f9');
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a').text(input.programTitle, left + 14, y + 9);
    y += 34 + 20;

    doc.font('Helvetica').fontSize(10).fillColor('#334155');
    const line = (label: string, value: string) => {
      doc.font('Helvetica-Bold').text(`${label}: `, left, y, { continued: true });
      doc.font('Helvetica').text(value);
      y += 18;
    };
    line('Trainer', input.trainerName);
    if (input.centerName) line('Center', input.centerName);
    line('Date', fmtDate(input.date));
    line('Training held', input.hadTrainingToday ? 'Yes' : 'No');
    if (input.hadTrainingToday) {
      line('Trainees Present', `${input.traineesPresent} of ${input.traineesTotal}`);
    }
    y += 10;

    if (input.hadTrainingToday) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text('Topics Covered', left, y);
      y += 15;
      doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(input.topicsCovered ?? '—', left, y, { width: contentWidth, lineGap: 3 });
      y = doc.y + 16;
    } else {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#dc2626').text('Reason no training was held', left, y);
      y += 15;
      doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(input.noTrainingReason ?? '—', left, y, { width: contentWidth, lineGap: 3 });
      y = doc.y + 16;
    }

    if (input.notes) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text('Notes / Challenges', left, y);
      y += 15;
      doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(input.notes, left, y, { width: contentWidth, lineGap: 3 });
    }

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#94a3b8')
      .text(`PDF generated on ${fmtDate(input.generatedAt)}`, left, 780, { width: contentWidth, align: 'center' });

    doc.end();
  });
}
