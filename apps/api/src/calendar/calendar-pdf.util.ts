import PDFDocument from 'pdfkit';

export interface CalendarPdfEvent {
  title: string;
  category: string;
  startDate: Date;
  endDate: Date | null;
}

export interface CalendarPdfInput {
  school: { name: string };
  year: number;
  /** 0-indexed, JS Date convention (0 = January) */
  month: number;
  events: CalendarPdfEvent[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORY_COLOR: Record<string, string> = {
  HOLIDAY: '#16a34a',
  TERM: '#0f172a',
  EXAM: '#dc2626',
  MEETING: '#7c3aed',
  SPORTS: '#ea580c',
  TRIP: '#0ea5e9',
  OTHER: '#64748b',
};

function eventFallsOn(e: CalendarPdfEvent, day: Date): boolean {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const start = e.startDate;
  const end = e.endDate ?? e.startDate;
  return start < dayEnd && end >= dayStart;
}

/** Draws a real 7-column month grid (not just a list) — day cells hold up to 2 event titles with a
 * "+N more" overflow indicator, color-coded by category. Falls back gracefully with an empty cell
 * for days with no events. */
export function renderCalendarPdf(input: CalendarPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 72;
    const startX = 36;
    let y = 40;

    doc.fontSize(16).fillColor('#0f172a').text(input.school.name, startX, y);
    doc.fontSize(12).fillColor('#475569').text(`${MONTH_NAMES[input.month]} ${input.year}`, startX, y + 20);
    y += 50;

    const colWidth = pageWidth / 7;
    doc.fontSize(9).fillColor('#94a3b8');
    DAY_NAMES.forEach((d, i) => doc.text(d, startX + i * colWidth, y, { width: colWidth, align: 'center' }));
    y += 16;

    const firstOfMonth = new Date(input.year, input.month, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(input.year, input.month + 1, 0).getDate();
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    const rowHeight = 70;

    for (let cell = 0; cell < totalCells; cell++) {
      const col = cell % 7;
      const row = Math.floor(cell / 7);
      const dayNum = cell - startWeekday + 1;
      const cx = startX + col * colWidth;
      const cy = y + row * rowHeight;

      doc.rect(cx, cy, colWidth, rowHeight).strokeColor('#e2e8f0').stroke();

      if (dayNum >= 1 && dayNum <= daysInMonth) {
        const dayDate = new Date(input.year, input.month, dayNum);
        doc.fontSize(9).fillColor('#334155').text(String(dayNum), cx + 4, cy + 4);

        const dayEvents = input.events.filter((e) => eventFallsOn(e, dayDate));
        let ey = cy + 18;
        const shown = dayEvents.slice(0, 3);
        for (const e of shown) {
          doc
            .fontSize(6.5)
            .fillColor(CATEGORY_COLOR[e.category] ?? '#64748b')
            .text(`• ${e.title}`, cx + 4, ey, { width: colWidth - 8, height: 9, ellipsis: true });
          ey += 10;
        }
        if (dayEvents.length > shown.length) {
          doc.fontSize(6.5).fillColor('#94a3b8').text(`+${dayEvents.length - shown.length} more`, cx + 4, ey);
        }
      }
    }

    y += Math.ceil(totalCells / 7) * rowHeight + 20;
    doc.fontSize(8).fillColor('#64748b').text('Legend:', startX, y);
    let lx = startX + 45;
    for (const [cat, color] of Object.entries(CATEGORY_COLOR)) {
      doc.circle(lx + 3, y + 4, 3).fillColor(color).fill();
      doc.fontSize(7).fillColor('#475569').text(cat, lx + 10, y);
      lx += 70;
    }

    doc.end();
  });
}
