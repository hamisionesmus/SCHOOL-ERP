import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

function resolveUploadPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const path = join(process.cwd(), url.replace(/^\/+/, ''));
  return existsSync(path) ? path : null;
}

export interface ReportCardPdfInput {
  school: {
    name: string;
    logoUrl: string | null;
    mission: string | null;
    vision: string | null;
    motto: string | null;
    address: string | null;
  };
  student: {
    firstName: string;
    lastName: string;
    admissionNumber: string;
    photoUrl: string | null;
    gradeLevelName: string;
    className: string | null;
  };
  exam: { name: string; examType: string; term: number };
  marks: { subject: string; maxScore: number; score: number | null; rubricLevel: string | null; comment: string | null }[];
  generatedAt: Date;
}

/** Renders a single-page branded report card as a PDF buffer. Pure function — no DB access — so it
 * stays trivially testable and reusable if other documents (e.g. admission letters) need the same
 * school-branding header later. */
export function renderReportCardPdf(input: ReportCardPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const logoPath = resolveUploadPath(input.school.logoUrl);
    const photoPath = resolveUploadPath(input.student.photoUrl);

    // Header: logo + school identity
    if (logoPath) {
      try {
        doc.image(logoPath, 50, 45, { width: 60, height: 60, fit: [60, 60] });
      } catch {
        // corrupt/unreadable image — skip silently, the rest of the document still renders
      }
    }
    doc
      .fontSize(18)
      .fillColor('#0f172a')
      .text(input.school.name, logoPath ? 120 : 50, 50, { align: 'left' });
    if (input.school.motto) {
      doc.fontSize(10).fillColor('#64748b').text(input.school.motto, logoPath ? 120 : 50, 72);
    }
    if (input.school.address) {
      doc.fontSize(9).fillColor('#94a3b8').text(input.school.address, logoPath ? 120 : 50, 86);
    }

    doc.moveDown(3);
    doc
      .moveTo(50, 120)
      .lineTo(545, 120)
      .strokeColor('#e2e8f0')
      .stroke();

    doc.fontSize(14).fillColor('#0f172a').text('STUDENT REPORT CARD', 50, 135, { align: 'center' });
    doc
      .fontSize(10)
      .fillColor('#64748b')
      .text(`${input.exam.name} (${input.exam.examType}) — Term ${input.exam.term}`, 50, 155, { align: 'center' });

    // Student block
    const blockTop = 185;
    if (photoPath) {
      try {
        doc.image(photoPath, 50, blockTop, { width: 70, height: 70, fit: [70, 70] });
      } catch {
        // ditto
      }
    }
    const textX = photoPath ? 135 : 50;
    doc
      .fontSize(12)
      .fillColor('#0f172a')
      .text(`${input.student.firstName} ${input.student.lastName}`, textX, blockTop);
    doc
      .fontSize(10)
      .fillColor('#475569')
      .text(`Admission No: ${input.student.admissionNumber}`, textX, blockTop + 18)
      .text(`Grade: ${input.student.gradeLevelName}`, textX, blockTop + 34)
      .text(`Class: ${input.student.className ?? '-'}`, textX, blockTop + 50);

    // Marks table
    let y = blockTop + 100;
    const colX = { subject: 50, score: 300, max: 400, comment: 460 };
    doc.fontSize(10).fillColor('#0f172a');
    doc.text('Subject', colX.subject, y, { continued: false });
    doc.text('Score', colX.score, y);
    doc.text('Max', colX.max, y);
    doc.text('Comment', colX.comment, y);
    y += 16;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
    y += 8;

    doc.fontSize(10).fillColor('#334155');
    if (input.marks.length === 0) {
      doc.text('No approved marks for this exam yet.', colX.subject, y);
      y += 18;
    } else {
      for (const mark of input.marks) {
        doc.text(mark.subject, colX.subject, y, { width: 240 });
        doc.text(mark.rubricLevel ?? String(mark.score ?? '-'), colX.score, y);
        doc.text(mark.rubricLevel ? '-' : String(mark.maxScore), colX.max, y);
        doc.text(mark.comment ?? '-', colX.comment, y, { width: 85 });
        y += 20;
      }
    }

    // Mission/vision footer
    y += 20;
    if (input.school.mission || input.school.vision) {
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
      y += 12;
      if (input.school.mission) {
        doc.fontSize(8).fillColor('#94a3b8').text(`Mission: ${input.school.mission}`, 50, y, { width: 495 });
        y += doc.heightOfString(`Mission: ${input.school.mission}`, { width: 495 }) + 6;
      }
      if (input.school.vision) {
        doc.fontSize(8).fillColor('#94a3b8').text(`Vision: ${input.school.vision}`, 50, y, { width: 495 });
      }
    }

    doc
      .fontSize(7)
      .fillColor('#cbd5e1')
      .text(`Generated ${input.generatedAt.toLocaleString()}`, 50, 780, { align: 'center', width: 495 });

    doc.end();
  });
}
