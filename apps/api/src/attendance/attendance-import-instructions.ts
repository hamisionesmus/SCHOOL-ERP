export const ATTENDANCE_IMPORT_INSTRUCTIONS: string[] = [
  'This template is for bulk recording attendance — useful when the system or internet is down and a class teacher marks a register on paper, then imports it once back online.',
  'Do not rename, remove, or reorder the column headers — the import will reject the file if the headers don\'t match exactly.',
  'Admission Number, Class Name, Date, and Status are required on every row.',
  'Admission Number must match an existing student.',
  'Class Name must match an existing class in the CURRENT academic year.',
  'Date must be in YYYY-MM-DD format.',
  'Status must be exactly PRESENT, ABSENT, LATE, or EXCUSED (use the dropdown).',
  'If attendance for a class and date has already been submitted and locked, those rows are rejected — ask a School Administrator to reopen that class/date first (same rule as the normal attendance-marking screen).',
  'Two rows in the same file cannot give conflicting statuses for the same student on the same class and date — fix conflicts before importing.',
  'If any row in the file has an error, NOTHING is imported — fix every listed error and re-upload the whole file.',
];
