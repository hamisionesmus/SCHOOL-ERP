export const TRAINEE_IMPORT_INSTRUCTIONS: string[] = [
  'This template is for bulk creating and updating trainees — useful when the system or internet is down and admins record enrollments on paper/offline, then import once back online.',
  'Trainee Number is the key that decides create vs. update: leave it BLANK to create a new trainee, or fill in an existing trainee number to update that trainee\'s other fields. The trainee number itself is never changed by an import (it is auto-generated for new trainees).',
  'Do not rename, remove, or reorder the column headers — the import will reject the file if the headers don\'t match exactly.',
  'Full Name, Gender, and Program Title are required for every new trainee.',
  'Gender must be exactly MALE, FEMALE, or OTHER (use the dropdown).',
  'Program Title must match an existing training program\'s title exactly — see the dropdown for valid titles.',
  'Age (optional) must be a positive whole number.',
  'Two rows in the same file cannot use the same Trainee Number — fix duplicates before importing.',
  'If any row in the file has an error, NOTHING is imported — fix every listed error and re-upload the whole file.',
  'Filling trainee names in ahead of time (via this import or the admin roster) lets trainers simply mark attendance against existing names on the daily register instead of retyping them every day.',
];
