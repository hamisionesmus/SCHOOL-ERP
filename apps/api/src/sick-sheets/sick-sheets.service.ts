import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { PlatformPrismaService } from '../common/prisma/platform-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CreateSickSheetDto } from './dto/create-sick-sheet.dto';
import { renderSickSheetPdf } from './sick-sheet-pdf.util';

@Injectable()
export class SickSheetsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly platformPrisma: PlatformPrismaService,
  ) {}

  /** A School Administrator can issue for any student. A Class Teacher (or anyone else holding
   * HEALTH:ISSUE_SICK_SHEET without the admin role) is restricted to students in a class where
   * they're the class teacher of record — same row-level pattern as AttendanceService.mark(). */
  async create(user: JwtUserPayload, dto: CreateSickSheetDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const student = await db.student.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const isAdmin = user.roles?.includes('School Administrator');
    if (!isAdmin) {
      if (!student.currentClassId) {
        throw new ForbiddenException('This student has no assigned class — ask a School Administrator to issue this');
      }
      const schoolClass = await db.schoolClass.findUnique({ where: { id: student.currentClassId } });
      if (schoolClass?.classTeacherId !== user.sub) {
        throw new ForbiddenException('Only this student\'s class teacher or a School Administrator can issue a sick sheet');
      }
    }

    return db.sickSheet.create({
      data: {
        studentId: dto.studentId,
        issuedByUserId: user.sub,
        reason: dto.reason,
        recommendedRestUntil: dto.recommendedRestUntil ? new Date(dto.recommendedRestUntil) : undefined,
        notes: dto.notes,
      },
      include: { student: true, issuedBy: true },
    });
  }

  async list(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];
    const isAdmin = user.roles?.includes('School Administrator');

    const where = isAdmin
      ? {}
      : perms.includes('HEALTH:ISSUE_SICK_SHEET')
        ? { issuedByUserId: user.sub }
        : perms.includes('STUDENT:VIEW_OWN_CHILD')
          ? { student: { guardians: { some: { guardianUserId: user.sub } } } }
          : perms.includes('STUDENT:VIEW_OWN_RECORD')
            ? { student: { userId: user.sub } }
            : { issuedByUserId: user.sub };

    return db.sickSheet.findMany({
      where,
      include: { student: true, issuedBy: true },
      orderBy: { dateIssued: 'desc' },
    });
  }

  async pdf(user: JwtUserPayload, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const sheet = await db.sickSheet.findUnique({
      where: { id },
      include: { student: { include: { gradeLevel: true } }, issuedBy: true },
    });
    if (!sheet) throw new NotFoundException('Sick sheet not found');

    const tenant = await this.platformPrisma.tenant.findFirst({ where: { schemaName: user.tenantSchema! } });

    const buffer = await renderSickSheetPdf({
      school: { name: tenant?.name ?? 'School' },
      student: {
        fullName: `${sheet.student.firstName} ${sheet.student.lastName}`,
        admissionNumber: sheet.student.admissionNumber,
        gradeLevel: sheet.student.gradeLevel.name,
      },
      issuedBy: { fullName: sheet.issuedBy.fullName },
      dateIssued: sheet.dateIssued,
      reason: sheet.reason,
      recommendedRestUntil: sheet.recommendedRestUntil,
      notes: sheet.notes,
    });

    return {
      buffer,
      filename: `${sheet.student.lastName}_${sheet.student.firstName}_SickSheet_${sheet.dateIssued.toISOString().slice(0, 10)}.pdf`,
    };
  }
}
