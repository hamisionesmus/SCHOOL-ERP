export const MARKS_IMPORT_INSTRUCTIONS: string[] = [
  'This template is for bulk entering marks for ONE exam subject at a time — download it from the specific exam subject you\'re working on, useful when the system or internet is down and marks are recorded on paper first.',
  'Do not rename, remove, or reorder the column headers — the import will reject the file if the headers don\'t match exactly.',
  'Admission Number is required and must match an existing student.',
  'For NUMERIC-scored subjects: Score is required, a whole number between 0 and the subject\'s maximum score.',
  'For RUBRIC-scored subjects: Rubric Level is required — EE, ME, AE, or BE (use the dropdown).',
  'Comment is optional.',
  'Re-uploading the same Admission Number updates that student\'s mark — there is no separate "create vs update" choice, exactly like typing marks into the normal entry screen.',
  'Marks can only be imported while this exam subject is still in DRAFT status — once submitted for approval, re-import is blocked the same way manual entry is blocked, until a School Administrator reopens it.',
  'If any row in the file has an error, NOTHING is imported — fix every listed error and re-upload the whole file.',
];
