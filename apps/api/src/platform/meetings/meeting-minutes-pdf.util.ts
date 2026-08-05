import PDFDocument from 'pdfkit';
import { resolveUploadPath, band, fmtDate } from '../billing/invoice-pdf.util';

export interface MeetingMinutesPdfInput {
  logoUrl: string | null;
  title: string;
  description: string | null;
  agenda: string[];
  scheduledAt: Date;
  organizerName: string;
  present: { name: string | null; email: string }[];
  absent: { name: string | null; email: string }[];
  minutes: string | null;
  minutesUpdatedByName: string | null;
  minutesUpdatedAt: Date | null;
  generatedAt: Date;
}

const COMPANY_NAME = 'Hamzone Technologies';

/** Renders a meeting's minutes as a branded PDF — same header/logo treatment as
 * renderPlatformInvoicePdf (invoice-pdf.util.ts), reused rather than duplicated. Downloadable from
 * the dashboard and attachable to a "share minutes" email, either to a system user or an outside
 * address. */
export function renderMeetingMinutesPdf(input: MeetingMinutesPdfInput): Promise<Buffer> {
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
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text(COMPANY_NAME, left + 60, 58);
    } else {
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text(COMPANY_NAME, left, 55);
    }
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Meeting Minutes', left, 90);

    let y = 130;
    band(doc, left, y, contentWidth, 62, '#f1f5f9');
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#0f172a').text(input.title, left + 14, y + 10, { width: contentWidth - 28 });
    doc.font('Helvetica').fontSize(9).fillColor('#475569');
    doc.text(`${fmtDate(input.scheduledAt)} · Organized by ${input.organizerName}`, left + 14, y + 34);
    y += 62 + 20;

    if (input.description) {
      doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(input.description, left, y, { width: contentWidth });
      y += doc.heightOfString(input.description, { width: contentWidth }) + 16;
    }

    if (input.agenda.length > 0) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Agenda', left, y);
      y += 16;
      doc.font('Helvetica').fontSize(9.5).fillColor('#334155');
      for (const [i, item] of input.agenda.entries()) {
        doc.text(`${i + 1}. ${item}`, left, y, { width: contentWidth });
        y += doc.heightOfString(`${i + 1}. ${item}`, { width: contentWidth }) + 4;
      }
      y += 12;
    }

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(`Attendance (${input.present.length} present, ${input.absent.length} absent)`, left, y);
    y += 16;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#16a34a').text('Present:', left, y);
    y += 13;
    doc.font('Helvetica').fontSize(9).fillColor('#334155');
    if (input.present.length === 0) {
      doc.text('None recorded', left, y);
      y += 13;
    } else {
      for (const p of input.present) {
        doc.text(`- ${p.name ?? p.email} (${p.email})`, left, y);
        y += 13;
      }
    }
    y += 6;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#dc2626').text('Absent:', left, y);
    y += 13;
    doc.font('Helvetica').fontSize(9).fillColor('#334155');
    if (input.absent.length === 0) {
      doc.text('None', left, y);
      y += 13;
    } else {
      for (const a of input.absent) {
        doc.text(`- ${a.name ?? a.email} (${a.email})`, left, y);
        y += 13;
      }
    }
    y += 20;

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Minutes', left, y);
    y += 16;
    doc.font('Helvetica').fontSize(9.5).fillColor('#334155');
    const minutesText = input.minutes?.trim() || 'No minutes recorded yet.';
    doc.text(minutesText, left, y, { width: contentWidth });
    y += doc.heightOfString(minutesText, { width: contentWidth }) + 16;

    if (input.minutesUpdatedByName && input.minutesUpdatedAt) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#94a3b8')
        .text(`Last updated by ${input.minutesUpdatedByName} on ${fmtDate(input.minutesUpdatedAt)}`, left, y);
    }

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#94a3b8')
      .text('This is an electronically generated document.', left, 766, { width: contentWidth, align: 'center' });
    doc.text(`PDF generated on ${fmtDate(input.generatedAt)}`, left, 780, { width: contentWidth, align: 'center' });

    doc.end();
  });
}
