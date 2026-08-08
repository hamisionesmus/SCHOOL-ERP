export const INVOICE_IMPORT_INSTRUCTIONS: string[] = [
  'This template is for bulk creating invoices and updating an invoice\'s due date — useful when the system or internet is down and staff record billing on paper/offline, then import once back online.',
  'Invoice Number is the key that decides create vs. update: leave it BLANK to create a new invoice, or fill in an existing invoice number to update just its Due Date. All other fields on an existing invoice cannot be changed by import — an invoice with payments already recorded against it must stay structurally stable.',
  'Do not rename, remove, or reorder the column headers — the import will reject the file if the headers don\'t match exactly.',
  'Admission Number, Academic Year, Term, Amount (KES), and Due Date are required for every new invoice.',
  'Admission Number must match an existing student.',
  'Academic Year must match an existing academic year name exactly (e.g. "2026").',
  'Amount must be a whole number of Kenyan Shillings — this system does not track cents, so do not enter decimals (e.g. use 5000, not 5000.50).',
  'Fee Structure Name (optional) must match an existing fee structure exactly if provided — and if it\'s provided, Amount must match that fee structure\'s amount exactly, or the row is rejected (protects against a stale or mistyped amount).',
  'Due Date must be in YYYY-MM-DD format.',
  'Status is set automatically (starts PENDING, becomes PARTIALLY_PAID or PAID only as real payments are recorded) — it is never set directly by this import.',
  'Two rows in the same file cannot use the same Invoice Number — fix duplicates before importing.',
  'If any row in the file has an error, NOTHING is imported — fix every listed error and re-upload the whole file.',
];
