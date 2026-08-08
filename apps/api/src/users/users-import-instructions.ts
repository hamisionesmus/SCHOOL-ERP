export const USER_IMPORT_INSTRUCTIONS: string[] = [
  'This template is for bulk creating and updating staff accounts — useful when the system or internet is down and staff details are recorded on paper, then imported once back online.',
  'Email is the key that decides create vs. update: if the email already belongs to a staff account, that account\'s Full Name, Phone, and Roles are updated. If the email is new, a new account is created.',
  'Do not rename, remove, or reorder the column headers — the import will reject the file if the headers don\'t match exactly.',
  'Email and Full Name are required on every row. Roles is required for a new account.',
  'Roles must be one or more existing role names, separated by commas (e.g. "Class Teacher, Finance Officer") — see your Roles/Permissions settings for the exact names in use at this school.',
  'Passwords are never accepted from this file for security. A new account gets a random temporary password shown once, right after import, in a yellow box below — write it down and relay it to that staff member yourself; it cannot be shown again. An existing account\'s password is never changed by import.',
  'Phone is optional.',
  'Two rows in the same file cannot use the same Email — fix duplicates before importing.',
  'If any row in the file has an error, NOTHING is imported — fix every listed error and re-upload the whole file.',
];
