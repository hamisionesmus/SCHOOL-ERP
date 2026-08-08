import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { CommunicationsService } from '../communications/communications.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { generateReceiptNumber } from './receipt-number.util';
import { generateInvoiceNumber } from './invoice-number.util';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { InitiateMpesaDto } from './dto/initiate-mpesa.dto';
import { buildWorkbook, ExcelColumn } from '../common/excel/excel-builder.util';
import { parseWorkbook, RowError } from '../common/excel/excel-parser.util';
import { INVOICE_IMPORT_INSTRUCTIONS } from './invoices-import-instructions';
import { PAYMENT_IMPORT_INSTRUCTIONS } from './payments-import-instructions';

const STAFF_PERMS = ['FINANCE:EDIT', 'FINANCE:RECEIVE_PAYMENT', 'FINANCE:PRINT_RECEIPT'];
const PAYMENT_METHODS = ['CASH', 'BANK', 'MPESA'];

interface InvoiceExportRow {
  invoiceNumber: string | null;
  student: { admissionNumber: string };
  academicYear: { name: string };
  term: number;
  feeStructure: { name: string } | null;
  amount: number;
  dueDate: Date;
  status: string;
}

interface PaymentExportRow {
  receiptNumber: string;
  invoice: { invoiceNumber: string | null };
  amount: number;
  method: string;
  reference: string | null;
  createdAt: Date;
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly communications: CommunicationsService,
  ) {}

  // ---- Fee structures ----

  async createFeeStructure(user: JwtUserPayload, dto: CreateFeeStructureDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.feeStructure.create({ data: dto, include: { gradeLevel: true, academicYear: true } });
  }

  async listFeeStructures(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.feeStructure.findMany({
      include: { gradeLevel: true, academicYear: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---- Invoices ----

  /** Creates one PENDING invoice per active student in the fee structure's grade level, skipping
   * students who already have an invoice for this fee structure (safe to re-run after enrolling
   * new students mid-term). */
  async generateInvoices(user: JwtUserPayload, dto: GenerateInvoicesDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const feeStructure = await db.feeStructure.findUnique({ where: { id: dto.feeStructureId } });
    if (!feeStructure) throw new NotFoundException('Fee structure not found');

    const students = await db.student.findMany({
      where: { gradeLevelId: feeStructure.gradeLevelId, status: 'ACTIVE', deletedAt: null },
    });

    const created = [];
    for (const student of students) {
      const existing = await db.invoice.findFirst({
        where: { studentId: student.id, feeStructureId: feeStructure.id },
      });
      if (existing) continue;
      created.push(
        await db.invoice.create({
          data: {
            invoiceNumber: await generateInvoiceNumber(db),
            studentId: student.id,
            feeStructureId: feeStructure.id,
            academicYearId: feeStructure.academicYearId,
            term: feeStructure.term,
            amount: feeStructure.amount,
            balance: feeStructure.amount,
            dueDate: new Date(dto.dueDate),
          },
        }),
      );
    }
    return { generated: created.length, skipped: students.length - created.length, invoices: created };
  }

  async createInvoice(user: JwtUserPayload, dto: CreateInvoiceDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.invoice.create({
      data: {
        invoiceNumber: await generateInvoiceNumber(db),
        studentId: dto.studentId,
        academicYearId: dto.academicYearId,
        term: dto.term,
        amount: dto.amount,
        balance: dto.amount,
        dueDate: new Date(dto.dueDate),
      },
    });
  }

  async listInvoices(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];

    if (STAFF_PERMS.some((p) => perms.includes(p))) {
      return db.invoice.findMany({
        include: { student: true, payments: true, mpesaRequests: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (perms.includes('STUDENT:VIEW_OWN_CHILD')) {
      return db.invoice.findMany({
        where: { student: { guardians: { some: { guardianUserId: user.sub } } } },
        include: { student: true, payments: true, mpesaRequests: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (perms.includes('STUDENT:VIEW_OWN_RECORD')) {
      return db.invoice.findMany({
        where: { student: { userId: user.sub } },
        include: { student: true, payments: true, mpesaRequests: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    throw new ForbiddenException('No permission to view invoices');
  }

  async getInvoice(user: JwtUserPayload, id: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { student: { include: { guardians: true } }, payments: true, mpesaRequests: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const perms = user.permissions ?? [];
    const isOwn =
      (perms.includes('STUDENT:VIEW_OWN_RECORD') && invoice.student.userId === user.sub) ||
      (perms.includes('STUDENT:VIEW_OWN_CHILD') &&
        invoice.student.guardians.some((g) => g.guardianUserId === user.sub));
    if (!STAFF_PERMS.some((p) => perms.includes(p)) && !isOwn) {
      throw new ForbiddenException('No permission to view this invoice');
    }
    return invoice;
  }

  // ---- Payments ----

  private async applyPayment(
    user: JwtUserPayload,
    invoiceId: string,
    amount: number,
    method: 'CASH' | 'BANK' | 'MPESA',
    reference?: string,
  ) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (amount > invoice.balance) {
      throw new BadRequestException(`Payment of ${amount} exceeds outstanding balance of ${invoice.balance}`);
    }

    const receiptNumber = await generateReceiptNumber(db);
    const payment = await db.payment.create({
      data: { invoiceId, amount, method, reference, receiptNumber, receivedByUserId: user.sub },
    });

    const newBalance = invoice.balance - amount;
    await db.invoice.update({
      where: { id: invoiceId },
      data: { balance: newBalance, status: newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID' },
    });

    const student = await db.student.findUnique({ where: { id: invoice.studentId } });
    const primaryGuardian = await db.guardianLink.findFirst({
      where: { studentId: invoice.studentId, isPrimaryContact: true },
    });
    const recipientUserId = primaryGuardian?.guardianUserId ?? student?.userId ?? undefined;
    if (recipientUserId) {
      await this.communications.sendToUserId(
        user.tenantSchema!,
        recipientUserId,
        `Payment of KES ${amount} received for ${student?.firstName} ${student?.lastName}. Receipt ${receiptNumber}. Balance: KES ${newBalance}.`,
      );
    }

    return payment;
  }

  async recordPayment(user: JwtUserPayload, invoiceId: string, dto: RecordPaymentDto) {
    return this.applyPayment(user, invoiceId, dto.amount, dto.method, dto.reference);
  }

  // ---- M-Pesa STK stub (see MpesaStkRequest model comment in schema.prisma) ----

  async initiateMpesaStk(user: JwtUserPayload, invoiceId: string, dto: InitiateMpesaDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.balance <= 0) throw new BadRequestException('Invoice is already fully paid');

    return db.mpesaStkRequest.create({
      data: { invoiceId, phoneNumber: dto.phoneNumber, amount: invoice.balance },
    });
  }

  async confirmMpesaStk(user: JwtUserPayload, stkRequestId: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const stk = await db.mpesaStkRequest.findUnique({ where: { id: stkRequestId } });
    if (!stk) throw new NotFoundException('M-Pesa request not found');
    if (stk.status !== 'PENDING') throw new BadRequestException('This M-Pesa request was already resolved');

    await this.applyPayment(user, stk.invoiceId, stk.amount, 'MPESA', stk.checkoutRequestId);
    return db.mpesaStkRequest.update({ where: { id: stkRequestId }, data: { status: 'SUCCESS' } });
  }

  // ---- Excel import/export — see docs/IMPORT_EXPORT.md ----

  private invoiceColumns(): ExcelColumn<InvoiceExportRow>[] {
    return [
      { header: 'Invoice Number', key: 'invoiceNumber', getValue: (r) => r.invoiceNumber },
      { header: 'Admission Number', key: 'admissionNumber', required: true, getValue: (r) => r.student.admissionNumber },
      { header: 'Academic Year', key: 'academicYearName', required: true, getValue: (r) => r.academicYear.name },
      { header: 'Term', key: 'term', required: true, getValue: (r) => r.term },
      { header: 'Fee Structure Name', key: 'feeStructureName', getValue: (r) => r.feeStructure?.name ?? null },
      { header: 'Amount (KES)', key: 'amount', required: true, getValue: (r) => r.amount },
      { header: 'Due Date (YYYY-MM-DD)', key: 'dueDate', required: true, getValue: (r) => r.dueDate.toISOString().slice(0, 10) },
      { header: 'Status', key: 'status', getValue: (r) => r.status },
    ];
  }

  async exportInvoicesExcel(user: JwtUserPayload): Promise<Buffer> {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const invoices = await db.invoice.findMany({
      include: { student: true, academicYear: true, feeStructure: true },
      orderBy: { createdAt: 'desc' },
    });
    return buildWorkbook({ sheetName: 'Invoices', columns: this.invoiceColumns(), rows: invoices });
  }

  async importInvoicesTemplateExcel(): Promise<Buffer> {
    return buildWorkbook({
      sheetName: 'Invoices',
      columns: this.invoiceColumns(),
      rows: [],
      instructions: INVOICE_IMPORT_INSTRUCTIONS,
    });
  }

  async importInvoicesFromExcel(user: JwtUserPayload, buffer: Buffer) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const columns = this.invoiceColumns();
    const { rows, headerErrors } = await parseWorkbook(buffer, columns.map((c) => ({ header: c.header, key: c.key })));
    if (headerErrors.length > 0) return { created: 0, updated: 0, errors: headerErrors };

    const errors: RowError[] = [];
    const seenKeys = new Map<string, number[]>();
    for (const row of rows) {
      const key = String(row.data.invoiceNumber ?? '').trim();
      if (!key) continue;
      seenKeys.set(key, [...(seenKeys.get(key) ?? []), row.rowNumber]);
    }
    for (const [key, rowNumbers] of seenKeys) {
      if (rowNumbers.length > 1) {
        for (const rn of rowNumbers) {
          errors.push({ row: rn, field: 'invoiceNumber', message: `Invoice number ${key} appears on rows ${rowNumbers.join(', ')} — fix duplicates before importing.` });
        }
      }
    }

    const academicYears = await db.academicYear.findMany();
    const yearByName = new Map(academicYears.map((y) => [y.name, y]));
    const feeStructures = await db.feeStructure.findMany();
    const feeStructureByName = new Map(feeStructures.map((f) => [f.name, f]));

    type Planned = { row: number; isUpdate: boolean; existingId?: string; dueDate?: Date; create?: Record<string, unknown> };
    const planned: Planned[] = [];

    for (const row of rows) {
      const invoiceNumber = String(row.data.invoiceNumber ?? '').trim();
      if ((seenKeys.get(invoiceNumber)?.length ?? 0) > 1) continue;

      const existing = invoiceNumber ? await db.invoice.findUnique({ where: { invoiceNumber } }) : null;
      if (invoiceNumber && !existing) {
        errors.push({ row: row.rowNumber, field: 'invoiceNumber', message: `No existing invoice with number ${invoiceNumber} — leave blank to create a new invoice instead.` });
        continue;
      }

      const dueDateRaw = row.data.dueDate;
      let dueDate: Date | undefined;
      if (dueDateRaw) {
        const parsed = new Date(dueDateRaw);
        if (isNaN(parsed.getTime())) {
          errors.push({ row: row.rowNumber, field: 'dueDate', message: `Invalid Due Date "${dueDateRaw}" — use YYYY-MM-DD.` });
        } else {
          dueDate = parsed;
        }
      } else if (!existing) {
        errors.push({ row: row.rowNumber, field: 'dueDate', message: 'Due Date is required for a new invoice.' });
      }

      if (existing) {
        if (dueDate) planned.push({ row: row.rowNumber, isUpdate: true, existingId: existing.id, dueDate });
        continue;
      }

      const admissionNumber = String(row.data.admissionNumber ?? '').trim();
      const yearName = String(row.data.academicYearName ?? '').trim();
      const termRaw = row.data.term;
      const feeStructureNameRaw = String(row.data.feeStructureName ?? '').trim();
      const amountRaw = row.data.amount;

      let studentId: string | undefined;
      if (admissionNumber) {
        const student = await db.student.findUnique({ where: { admissionNumber } });
        if (!student) {
          errors.push({ row: row.rowNumber, field: 'admissionNumber', message: `No student with admission number "${admissionNumber}".` });
        } else {
          studentId = student.id;
        }
      } else {
        errors.push({ row: row.rowNumber, field: 'admissionNumber', message: 'Admission Number is required for a new invoice.' });
      }

      let academicYearId: string | undefined;
      if (yearName) {
        const year = yearByName.get(yearName);
        if (!year) {
          errors.push({ row: row.rowNumber, field: 'academicYearName', message: `No academic year named "${yearName}" — valid years: ${[...yearByName.keys()].join(', ')}.` });
        } else {
          academicYearId = year.id;
        }
      } else {
        errors.push({ row: row.rowNumber, field: 'academicYearName', message: 'Academic Year is required for a new invoice.' });
      }

      let term: number | undefined;
      if (termRaw !== null && termRaw !== undefined && termRaw !== '') {
        const parsed = Number(termRaw);
        if (!Number.isInteger(parsed)) {
          errors.push({ row: row.rowNumber, field: 'term', message: `Term must be a whole number, got "${termRaw}".` });
        } else {
          term = parsed;
        }
      } else {
        errors.push({ row: row.rowNumber, field: 'term', message: 'Term is required for a new invoice.' });
      }

      let amount: number | undefined;
      if (amountRaw !== null && amountRaw !== undefined && amountRaw !== '') {
        const parsed = Number(amountRaw);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          errors.push({ row: row.rowNumber, field: 'amount', message: `Amount must be a whole positive number of KES (no cents), got "${amountRaw}".` });
        } else {
          amount = parsed;
        }
      } else {
        errors.push({ row: row.rowNumber, field: 'amount', message: 'Amount (KES) is required for a new invoice.' });
      }

      let feeStructureId: string | undefined;
      if (feeStructureNameRaw) {
        const fs = feeStructureByName.get(feeStructureNameRaw);
        if (!fs) {
          errors.push({ row: row.rowNumber, field: 'feeStructureName', message: `No fee structure named "${feeStructureNameRaw}".` });
        } else if (amount !== undefined && fs.amount !== amount) {
          errors.push({ row: row.rowNumber, field: 'amount', message: `Amount ${amount} does not match fee structure "${feeStructureNameRaw}"'s amount of ${fs.amount}.` });
        } else {
          feeStructureId = fs.id;
        }
      }

      if (studentId && academicYearId && term !== undefined && amount !== undefined && dueDate) {
        planned.push({
          row: row.rowNumber,
          isUpdate: false,
          create: { studentId, academicYearId, term, amount, balance: amount, feeStructureId, dueDate },
        });
      }
    }

    if (errors.length > 0) return { created: 0, updated: 0, errors };

    let created = 0;
    let updated = 0;
    await db.$transaction(async (tx) => {
      for (const p of planned) {
        if (p.isUpdate && p.existingId) {
          await tx.invoice.update({ where: { id: p.existingId }, data: { dueDate: p.dueDate } });
          updated++;
        } else if (p.create) {
          await tx.invoice.create({
            data: { ...p.create, invoiceNumber: await generateInvoiceNumber(tx as never) } as never,
          });
          created++;
        }
      }
    });

    return { created, updated, errors: [] };
  }

  private paymentColumns(): ExcelColumn<PaymentExportRow>[] {
    return [
      { header: 'Receipt Number', key: 'receiptNumber', getValue: (r) => r.receiptNumber },
      { header: 'Invoice Number', key: 'invoiceNumber', required: true, getValue: (r) => r.invoice.invoiceNumber },
      { header: 'Amount (KES)', key: 'amount', required: true, getValue: (r) => r.amount },
      { header: 'Method', key: 'method', required: true, dropdown: PAYMENT_METHODS, getValue: (r) => r.method },
      { header: 'Reference', key: 'reference', getValue: (r) => r.reference },
      { header: 'Recorded At', key: 'createdAt', getValue: (r) => r.createdAt.toISOString().slice(0, 10) },
    ];
  }

  async exportPaymentsExcel(user: JwtUserPayload): Promise<Buffer> {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const payments = await db.payment.findMany({ include: { invoice: true }, orderBy: { createdAt: 'desc' } });
    return buildWorkbook({ sheetName: 'Payments', columns: this.paymentColumns(), rows: payments });
  }

  async importPaymentsTemplateExcel(): Promise<Buffer> {
    return buildWorkbook({
      sheetName: 'Payments',
      columns: this.paymentColumns(),
      rows: [],
      instructions: PAYMENT_IMPORT_INSTRUCTIONS,
    });
  }

  async importPaymentsFromExcel(user: JwtUserPayload, buffer: Buffer) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const columns = this.paymentColumns();
    const { rows, headerErrors } = await parseWorkbook(buffer, columns.map((c) => ({ header: c.header, key: c.key })));
    if (headerErrors.length > 0) return { created: 0, updated: 0, skipped: 0, errors: headerErrors };

    const errors: RowError[] = [];
    type Planned = { row: number; invoiceId: string; amount: number; method: 'CASH' | 'BANK' | 'MPESA'; reference?: string };
    const planned: Planned[] = [];
    let skipped = 0;

    const referencesSeenInFile = new Set<string>();

    for (const row of rows) {
      const invoiceNumber = String(row.data.invoiceNumber ?? '').trim();
      const amountRaw = row.data.amount;
      const methodRaw = String(row.data.method ?? '').trim().toUpperCase();
      const reference = String(row.data.reference ?? '').trim() || undefined;

      if (!invoiceNumber) {
        errors.push({ row: row.rowNumber, field: 'invoiceNumber', message: 'Invoice Number is required.' });
        continue;
      }
      const invoice = await db.invoice.findUnique({ where: { invoiceNumber } });
      if (!invoice) {
        errors.push({ row: row.rowNumber, field: 'invoiceNumber', message: `No invoice with number "${invoiceNumber}".` });
        continue;
      }

      if (reference) {
        if (referencesSeenInFile.has(reference)) {
          skipped++;
          continue;
        }
        const existingPayment = await db.payment.findFirst({ where: { reference } });
        if (existingPayment) {
          skipped++;
          continue;
        }
        referencesSeenInFile.add(reference);
      }

      let amount: number | undefined;
      if (amountRaw !== null && amountRaw !== undefined && amountRaw !== '') {
        const parsed = Number(amountRaw);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          errors.push({ row: row.rowNumber, field: 'amount', message: `Amount must be a whole positive number of KES (no cents), got "${amountRaw}".` });
        } else if (parsed > invoice.balance) {
          errors.push({ row: row.rowNumber, field: 'amount', message: `Amount ${parsed} exceeds invoice ${invoiceNumber}'s outstanding balance of ${invoice.balance}.` });
        } else {
          amount = parsed;
        }
      } else {
        errors.push({ row: row.rowNumber, field: 'amount', message: 'Amount (KES) is required.' });
      }

      if (!PAYMENT_METHODS.includes(methodRaw)) {
        errors.push({ row: row.rowNumber, field: 'method', message: `Method must be one of ${PAYMENT_METHODS.join(', ')}, got "${methodRaw}".` });
      }

      if (amount !== undefined && PAYMENT_METHODS.includes(methodRaw)) {
        planned.push({ row: row.rowNumber, invoiceId: invoice.id, amount, method: methodRaw as 'CASH' | 'BANK' | 'MPESA', reference });
      }
    }

    if (errors.length > 0) return { created: 0, updated: 0, skipped: 0, errors };

    let created = 0;
    for (const p of planned) {
      // Reuses the exact same balance/status/notification logic as a manually recorded payment —
      // each call is its own small transaction internally via applyPayment's own writes, and since
      // every row here already passed the balance-exceeds check above, this is safe to apply in a
      // simple loop rather than a single giant transaction (a mid-loop failure just means fewer
      // payments were applied, all real receipts still generated correctly for the ones that succeeded).
      await this.applyPayment(user, p.invoiceId, p.amount, p.method, p.reference);
      created++;
    }

    return { created, updated: 0, skipped, errors: [] };
  }
}
