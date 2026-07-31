import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { CommunicationsService } from '../communications/communications.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { generateReceiptNumber } from './receipt-number.util';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { InitiateMpesaDto } from './dto/initiate-mpesa.dto';

const STAFF_PERMS = ['FINANCE:EDIT', 'FINANCE:RECEIVE_PAYMENT', 'FINANCE:PRINT_RECEIPT'];

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
}
