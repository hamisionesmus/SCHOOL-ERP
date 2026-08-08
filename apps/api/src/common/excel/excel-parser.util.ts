import ExcelJS from 'exceljs';

export interface ParsedRow {
  /** 1-based, matching the row number a user sees in Excel (header is row 1, so data starts at 2). */
  rowNumber: number;
  /** Keyed by column `key` (not the display header text), so callers never re-parse header strings. */
  data: Record<string, string | number | null>;
}

export interface RowError {
  row: number;
  field?: string;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  headerErrors: RowError[];
}

export interface ExpectedColumn {
  header: string;
  key: string;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

/** Loads the first worksheet that isn't named "Instructions" and validates its header row matches
 * expectedColumns exactly (order-independent, case-insensitive) before parsing any data — a
 * renamed/missing/reordered header never gets silently misread as a different column. Returned row
 * data is keyed by each column's stable `key`, not the display header text. */
export async function parseWorkbook(buffer: Buffer, expectedColumns: ExpectedColumn[]): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);

  const sheet = workbook.worksheets.find((s) => s.name !== 'Instructions') ?? workbook.worksheets[0];
  if (!sheet) {
    return { rows: [], headerErrors: [{ row: 1, message: 'No data worksheet found in the uploaded file.' }] };
  }

  const headerRow = sheet.getRow(1);
  const actualHeaders: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    actualHeaders.push(String(cell.value ?? '').trim());
  });

  const expectedHeaders = expectedColumns.map((c) => c.header);
  const expectedNormalized = expectedHeaders.map(normalizeHeader).sort();
  const actualNormalized = actualHeaders.map(normalizeHeader).sort();
  const headersMatch =
    expectedNormalized.length === actualNormalized.length && expectedNormalized.every((h, i) => h === actualNormalized[i]);

  if (!headersMatch) {
    return {
      rows: [],
      headerErrors: [
        {
          row: 1,
          message: `Column headers don't match the expected template. Expected: ${expectedHeaders.join(', ')}. Found: ${actualHeaders.join(', ') || '(none)'}. Please use the downloaded template without renaming columns.`,
        },
      ],
    };
  }

  // Map each actual column position -> its stable key, via normalized header text.
  const headerToKey = new Map(expectedColumns.map((c) => [normalizeHeader(c.header), c.key]));
  const columnKeysInOrder = actualHeaders.map((h) => headerToKey.get(normalizeHeader(h))!);

  const rows: ParsedRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const data: Record<string, string | number | null> = {};
    let hasAnyValue = false;
    columnKeysInOrder.forEach((key, idx) => {
      const cell = row.getCell(idx + 1);
      let value = cell.value;
      if (value && typeof value === 'object' && 'text' in (value as object)) {
        value = (value as { text: string }).text;
      }
      if (value !== null && value !== undefined && value !== '') hasAnyValue = true;
      data[key] = value instanceof Date ? value.toISOString() : (value as string | number | null);
    });
    if (hasAnyValue) rows.push({ rowNumber, data });
  });

  return { rows, headerErrors: [] };
}
