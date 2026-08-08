export const PAYMENT_IMPORT_INSTRUCTIONS: string[] = [
  'This template is for bulk recording payments received while the system or internet was down — every row is a NEW payment (payments are never edited or removed by import, only added, same as manually recording a payment).',
  'Do not rename, remove, or reorder the column headers — the import will reject the file if the headers don\'t match exactly.',
  'Invoice Number, Amount (KES), and Method are required on every row.',
  'Invoice Number must match an existing invoice — a payment can never create the invoice it belongs to.',
  'Amount must be a whole number of Kenyan Shillings (no cents) and cannot exceed the invoice\'s outstanding balance at the time of import.',
  'Method must be exactly CASH, BANK, or MPESA (use the dropdown).',
  'Reference (optional) is the bank slip number, M-Pesa code, etc. If a Reference value has ALREADY been recorded on a previous payment (imported or manual), that row is safely skipped rather than double-counted — so it is safe to re-upload the same file if you are not sure whether it was already imported.',
  'A receipt number is generated automatically for every imported payment, exactly like a payment recorded manually at the front desk.',
  'Imported payments are timestamped with the moment they are imported, not backdated to when the money was actually received — note the real date in your own paper records if that matters to you.',
  'There is no "status" column — PAID/PARTIALLY_PAID is always computed automatically from the amounts actually recorded, never set directly.',
  'Every row is checked BEFORE anything is recorded — if any row has an error (other than an already-recorded Reference, which is safely skipped, not an error), NOTHING is imported; fix every listed error and re-upload the whole file. Once checking passes, each payment is then recorded one at a time exactly as if entered manually at the front desk.',
];
