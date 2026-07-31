import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CreateBookDto } from './dto/create-book.dto';
import { IssueLoanDto } from './dto/issue-loan.dto';

const FINE_PER_DAY_LATE = 10; // KES

@Injectable()
export class LibraryService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async createBook(user: JwtUserPayload, dto: CreateBookDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.book.create({ data: { ...dto, availableCopies: dto.totalCopies } });
  }

  async listBooks(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.book.findMany({ orderBy: { title: 'asc' } });
  }

  async issueLoan(user: JwtUserPayload, dto: IssueLoanDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const book = await db.book.findUnique({ where: { id: dto.bookId } });
    if (!book) throw new NotFoundException('Book not found');
    if (book.availableCopies <= 0) throw new BadRequestException('No copies available');

    const [loan] = await db.$transaction([
      db.loan.create({
        data: { bookId: dto.bookId, studentId: dto.studentId, dueDate: new Date(dto.dueDate) },
        include: { book: true, student: true },
      }),
      db.book.update({ where: { id: dto.bookId }, data: { availableCopies: { decrement: 1 } } }),
    ]);
    return loan;
  }

  async returnLoan(user: JwtUserPayload, loanId: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const loan = await db.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.returnedAt) throw new BadRequestException('This loan was already returned');

    const now = new Date();
    const daysLate = Math.max(0, Math.ceil((now.getTime() - loan.dueDate.getTime()) / 86_400_000));
    const fineAmount = daysLate * FINE_PER_DAY_LATE;

    const [updatedLoan] = await db.$transaction([
      db.loan.update({ where: { id: loanId }, data: { returnedAt: now, fineAmount } }),
      db.book.update({ where: { id: loan.bookId }, data: { availableCopies: { increment: 1 } } }),
    ]);
    return updatedLoan;
  }

  async listLoans(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];

    if (perms.includes('LIBRARY:MANAGE')) {
      return db.loan.findMany({ include: { book: true, student: true }, orderBy: { borrowedAt: 'desc' } });
    }
    if (perms.includes('STUDENT:VIEW_OWN_CHILD')) {
      return db.loan.findMany({
        where: { student: { guardians: { some: { guardianUserId: user.sub } } } },
        include: { book: true, student: true },
        orderBy: { borrowedAt: 'desc' },
      });
    }
    if (perms.includes('STUDENT:VIEW_OWN_RECORD')) {
      return db.loan.findMany({
        where: { student: { userId: user.sub } },
        include: { book: true, student: true },
        orderBy: { borrowedAt: 'desc' },
      });
    }
    throw new ForbiddenException('No permission to view loans');
  }
}
