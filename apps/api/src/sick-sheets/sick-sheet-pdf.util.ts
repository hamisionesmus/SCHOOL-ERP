import PDFDocument from 'pdfkit';

export interface SickSheetPdfInput {
  school: { name: string };
  student: { fullName: string; admissionNumber: string; gradeLevel: string };
  issuedBy: { fullName: string };
  dateIssued: Date;
  reason: string;
  recommendedRestUntil: Date | null;
  notes: string | null;
}

/** Renders a printable sick-sheet/excuse note as a single-page PDF. Same pattern as
 * payslip-pdf.util.ts's renderPayslipPdf() — pure function, no DB access. */
export function renderSickSheetPdf(input: SickSheetPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).fillColor('#0f172a').text(input.school.name, 50, 50);
    doc.fontSize(10).fillColor('#64748b').text('Sick Sheet / Medical Excuse Note', 50, 74);
    doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#e2e8f0').stroke();

    doc.fontSize(12).fillColor('#0f172a').text(input.student.fullName, 50, 115);
    doc
      .fontSize(10)
      .fillColor('#475569')
      .text(`${input.student.gradeLevel} · Admission No. ${input.student.admissionNumber}`, 50, 133);
    doc.fontSize(10).fillColor('#475569').text(`Date issued: ${input.dateIssued.toLocaleDateString('en-KE')}`, 50, 151);

    let y = 190;
    doc.fontSize(10).fillColor('#0f172a').text('Reason', 50, y);
    y += 18;
    doc.fontSize(11).fillColor('#334155').text(input.reason, 50, y, { width: 495 });
    y += doc.heightOfString(input.reason, { width: 495 }) + 24;

    if (input.recommendedRestUntil) {
      doc
        .fontSize(10)
        .fillColor('#0f172a')
        .text(`Recommended to stay home until: ${input.recommendedRestUntil.toLocaleDateString('en-KE')}`, 50, y);
      y += 26;
    }

    if (input.notes) {
      doc.fontSize(10).fillColor('#0f172a').text('Notes', 50, y);
      y += 16;
      doc.fontSize(9).fillColor('#64748b').text(input.notes, 50, y, { width: 495 });
      y += doc.heightOfString(input.notes, { width: 495 }) + 20;
    }

    y += 30;
    doc.moveTo(50, y).lineTo(220, y).strokeColor('#94a3b8').stroke();
    doc.fontSize(9).fillColor('#475569').text(`Issued by: ${input.issuedBy.fullName}`, 50, y + 6);

    doc
      .fontSize(7)
      .fillColor('#cbd5e1')
      .text(`Generated ${new Date().toLocaleString('en-KE')}`, 50, 780, { align: 'center', width: 495 });

    doc.end();
  });
}
