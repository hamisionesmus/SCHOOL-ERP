export const STUDENT_IMPORT_INSTRUCTIONS: string[] = [
  'This template is for bulk creating and updating students — useful when the system or internet is down and staff record admissions on paper/offline, then import once back online.',
  'Admission Number is the key that decides create vs. update: leave it BLANK to create a new student, or fill in an existing admission number to update that student\'s other fields. The admission number itself is never changed by an import.',
  'Do not rename, remove, or reorder the column headers — the import will reject the file if the headers don\'t match exactly.',
  'First Name, Last Name, Date of Birth, Gender, and Grade Level Code are required for every new student.',
  'Date of Birth must be in YYYY-MM-DD format (e.g. 2015-03-20).',
  'Gender must be exactly MALE or FEMALE (use the dropdown).',
  'Grade Level Code must match an existing grade level code in this school (e.g. PP1, PP2, G1..G9) — see the dropdown for valid codes.',
  'Current Class Name (optional) must match an existing class name in the CURRENT academic year — leave blank if not yet assigned to a class.',
  'Status (optional) defaults to ACTIVE if left blank — use the dropdown for valid values.',
  'Two rows in the same file cannot use the same Admission Number — fix duplicates before importing.',
  'If any row in the file has an error, NOTHING is imported — fix every listed error and re-upload the whole file.',
];
