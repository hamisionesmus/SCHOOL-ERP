import ExcelJS from 'exceljs';

export interface ExcelColumn<T> {
  header: string;
  key: string;
  width?: number;
  getValue: (row: T) => string | number | Date | null;
  /** A fixed dropdown list for this column, applied to every data row plus 200 blank rows below —
   * so a blank template still offers the dropdown on rows staff add themselves. */
  dropdown?: string[];
  /** Bolds the header and adds a "Required" cell comment — a visual cue, not a hard Excel constraint
   * (the real enforcement happens server-side when the file is re-imported). */
  required?: boolean;
}

export interface BuildWorkbookInput<T> {
  sheetName: string;
  columns: ExcelColumn<T>[];
  rows: T[];
  /** One bullet per line, rendered as a leading "Instructions" worksheet. Omit for a pure data export
   * with no template/instructions (e.g. exporting current data isn't necessarily meant to be re-imported). */
  instructions?: string[];
  /** Header row fill color, matches the '#0f172a'/'#f1f5f9' band() convention used in the PDF utils. */
  brandColor?: string;
}

const HEADER_FILL = '0F172A';
const HEADER_FONT_COLOR = 'FFFFFF';
const BLANK_TEMPLATE_EXTRA_ROWS = 200;

export async function buildWorkbook<T>(input: BuildWorkbookInput<T>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hamzone Technologies';
  workbook.created = new Date();

  if (input.instructions && input.instructions.length > 0) {
    const instructionsSheet = workbook.addWorksheet('Instructions');
    instructionsSheet.getColumn(1).width = 110;
    instructionsSheet.addRow([`${input.sheetName} — Import/Export Instructions`]).font = { bold: true, size: 14 };
    instructionsSheet.addRow([]);
    for (const line of input.instructions) {
      const row = instructionsSheet.addRow([`•  ${line}`]);
      row.alignment = { wrapText: true, vertical: 'top' };
    }
  }

  const sheet = workbook.addWorksheet(input.sheetName);
  const headerFillColor = (input.brandColor ?? HEADER_FILL).replace('#', '').toUpperCase();

  sheet.columns = input.columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? Math.max(col.header.length + 4, 14),
  }));

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const col = input.columns[colNumber - 1];
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${headerFillColor}` } };
    cell.font = { bold: true, color: { argb: `FF${HEADER_FONT_COLOR}` } };
    cell.alignment = { vertical: 'middle' };
    if (col?.required) {
      cell.note = 'Required — do not leave blank.';
    }
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of input.rows) {
    const values: Record<string, string | number | Date | null> = {};
    for (const col of input.columns) {
      values[col.key] = col.getValue(row);
    }
    sheet.addRow(values);
  }

  const totalRows = Math.max(input.rows.length, 0) + BLANK_TEMPLATE_EXTRA_ROWS;
  input.columns.forEach((col, idx) => {
    if (!col.dropdown || col.dropdown.length === 0) return;
    const colLetter = sheet.getColumn(idx + 1).letter;
    for (let r = 2; r <= totalRows + 1; r++) {
      sheet.getCell(`${colLetter}${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${col.dropdown.join(',')}"`],
      };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
