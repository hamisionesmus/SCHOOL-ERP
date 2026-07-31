import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { PlatformPrismaService } from '../common/prisma/platform-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreatePayslipDto } from './dto/create-payslip.dto';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { renderPayslipPdf } from './payslip-pdf.util';

@Injectable()
export class HrService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly platformPrisma: PlatformPrismaService,
  ) {}

  async createLeaveRequest(user: JwtUserPayload, dto: CreateLeaveRequestDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.leaveRequest.create({
      data: {
        requestedByUserId: user.sub,
        leaveType: dto.leaveType,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        reason: dto.reason,
      },
    });
  }

  async listLeaveRequests(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];
    const include = {
      requestedBy: { select: { id: true, fullName: true, email: true } },
      reviewedBy: { select: { id: true, fullName: true } },
    } as const;

    if (perms.includes('HR:EDIT')) {
      return db.leaveRequest.findMany({ include, orderBy: { createdAt: 'desc' } });
    }
    return db.leaveRequest.findMany({
      where: { requestedByUserId: user.sub },
      include,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async setStatus(user: JwtUserPayload, id: string, status: 'APPROVED' | 'REJECTED') {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const request = await db.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('This request was already reviewed');

    return db.leaveRequest.update({
      where: { id },
      data: { status, reviewedByUserId: user.sub },
    });
  }

  approve(user: JwtUserPayload, id: string) {
    return this.setStatus(user, id, 'APPROVED');
  }

  reject(user: JwtUserPayload, id: string) {
    return this.setStatus(user, id, 'REJECTED');
  }

  // ---- Payslips (HR-issued; not computed from an automatic payroll engine — see docs/SRS.md §4.19) ----

  async issuePayslip(user: JwtUserPayload, dto: CreatePayslipDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const deductions = dto.deductions ?? 0;
    return db.payslip.upsert({
      where: {
        staffUserId_periodMonth_periodYear: {
          staffUserId: dto.staffUserId,
          periodMonth: dto.periodMonth,
          periodYear: dto.periodYear,
        },
      },
      update: { grossPay: dto.grossPay, deductions, netPay: dto.grossPay - deductions, notes: dto.notes },
      create: {
        staffUserId: dto.staffUserId,
        periodMonth: dto.periodMonth,
        periodYear: dto.periodYear,
        grossPay: dto.grossPay,
        deductions,
        netPay: dto.grossPay - deductions,
        notes: dto.notes,
        issuedByUserId: user.sub,
      },
      include: { staff: { select: { id: true, fullName: true, email: true } } },
    });
  }

  async listPayslips(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];
    const include = { staff: { select: { id: true, fullName: true, email: true } } } as const;

    if (perms.includes('HR:EDIT')) {
      return db.payslip.findMany({ include, orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }] });
    }
    return db.payslip.findMany({
      where: { staffUserId: user.sub },
      include,
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
  }

  async payslipPdf(user: JwtUserPayload, payslipId: string): Promise<{ buffer: Buffer; filename: string }> {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const [payslip, tenant] = await Promise.all([
      db.payslip.findUnique({
        where: { id: payslipId },
        include: { staff: { select: { id: true, fullName: true, email: true } } },
      }),
      this.platformPrisma.tenant.findFirst({ where: { schemaName: user.tenantSchema! } }),
    ]);
    if (!payslip) throw new NotFoundException('Payslip not found');

    const perms = user.permissions ?? [];
    if (!perms.includes('HR:EDIT') && payslip.staffUserId !== user.sub) {
      throw new ForbiddenException('No permission to view this payslip');
    }

    const buffer = await renderPayslipPdf({
      school: { name: tenant?.name ?? user.tenantSlug ?? 'School' },
      staff: { fullName: payslip.staff.fullName, email: payslip.staff.email },
      periodMonth: payslip.periodMonth,
      periodYear: payslip.periodYear,
      grossPay: payslip.grossPay,
      deductions: payslip.deductions,
      netPay: payslip.netPay,
      notes: payslip.notes,
      generatedAt: new Date(),
    });

    const slug = (s: string) => s.trim().replace(/[^a-zA-Z0-9]+/g, '');
    const filename = `${slug(payslip.staff.fullName)}_Payslip_${payslip.periodMonth}_${payslip.periodYear}.pdf`;
    return { buffer, filename };
  }

  // ---- Daily work log (self-service; any staff member) ----

  async upsertWorkLog(user: JwtUserPayload, dto: CreateWorkLogDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const date = new Date(dto.date);
    return db.workLog.upsert({
      where: { staffUserId_date: { staffUserId: user.sub, date } },
      update: { tasksDone: dto.tasksDone, tasksPending: dto.tasksPending },
      create: { staffUserId: user.sub, date, tasksDone: dto.tasksDone, tasksPending: dto.tasksPending },
    });
  }

  async listWorkLogs(user: JwtUserPayload, staffUserId?: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];
    const include = { staff: { select: { id: true, fullName: true, email: true } } } as const;

    if (perms.includes('HR:EDIT')) {
      return db.workLog.findMany({
        where: staffUserId ? { staffUserId } : undefined,
        include,
        orderBy: { date: 'desc' },
      });
    }
    return db.workLog.findMany({ where: { staffUserId: user.sub }, include, orderBy: { date: 'desc' } });
  }
}
