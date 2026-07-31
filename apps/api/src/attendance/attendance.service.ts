import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { ReopenAttendanceDto } from './dto/reopen-attendance.dto';

function toDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

@Injectable()
export class AttendanceService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /**
   * Only the class's classTeacherId or a School Administrator may submit its attendance (docs/SRS.md
   * §4.13) — this is a row-level check on top of the ATTENDANCE:MARK permission already enforced by
   * the controller guard, because "can mark attendance at all" and "can mark *this* class" are
   * different questions.
   */
  async mark(user: JwtUserPayload, dto: MarkAttendanceDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const schoolClass = await db.schoolClass.findUnique({ where: { id: dto.classId } });
    if (!schoolClass) throw new NotFoundException('Class not found');

    const isAdmin = user.roles?.includes('School Administrator');
    if (!isAdmin && schoolClass.classTeacherId !== user.sub) {
      throw new ForbiddenException('Only this class\'s class teacher can submit its attendance');
    }

    const date = toDateOnly(dto.date);
    const existing = await db.attendanceRecord.findFirst({ where: { classId: dto.classId, date } });
    if (existing?.locked) {
      throw new BadRequestException(
        'Attendance for this class and date is already submitted and locked. Ask a School Administrator to reopen it.',
      );
    }

    const records = await db.$transaction(
      dto.entries.map((entry) =>
        db.attendanceRecord.upsert({
          where: { studentId_classId_date: { studentId: entry.studentId, classId: dto.classId, date } },
          update: { status: entry.status, markedByUserId: user.sub, locked: true },
          create: {
            studentId: entry.studentId,
            classId: dto.classId,
            date,
            status: entry.status,
            markedByUserId: user.sub,
            locked: true,
          },
        }),
      ),
    );

    await db.auditLog.create({
      data: {
        actorUserId: user.sub,
        action: 'ATTENDANCE_SUBMITTED',
        entityType: 'AttendanceRecord',
        entityId: `${dto.classId}:${dto.date}`,
        newValue: dto.entries as unknown as object,
      },
    });

    return records;
  }

  async reopen(user: JwtUserPayload, dto: ReopenAttendanceDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const date = toDateOnly(dto.date);
    const result = await db.attendanceRecord.updateMany({
      where: { classId: dto.classId, date },
      data: { locked: false },
    });
    if (result.count === 0) throw new NotFoundException('No attendance records found for that class/date');

    await db.auditLog.create({
      data: {
        actorUserId: user.sub,
        action: 'ATTENDANCE_REOPENED',
        entityType: 'AttendanceRecord',
        entityId: `${dto.classId}:${dto.date}`,
      },
    });
    return { success: true, recordsReopened: result.count };
  }

  async list(user: JwtUserPayload, classId?: string, date?: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];
    const where: Record<string, unknown> = {};
    if (classId) where.classId = classId;
    if (date) where.date = toDateOnly(date);

    if (perms.includes('ATTENDANCE:VIEW')) {
      return db.attendanceRecord.findMany({
        where,
        include: { student: true, schoolClass: true },
        orderBy: { date: 'desc' },
      });
    }

    if (perms.includes('STUDENT:VIEW_OWN_CHILD')) {
      return db.attendanceRecord.findMany({
        where: { ...where, student: { guardians: { some: { guardianUserId: user.sub } } } },
        include: { student: true, schoolClass: true },
        orderBy: { date: 'desc' },
      });
    }

    if (perms.includes('STUDENT:VIEW_OWN_RECORD')) {
      return db.attendanceRecord.findMany({
        where: { ...where, student: { userId: user.sub } },
        include: { student: true, schoolClass: true },
        orderBy: { date: 'desc' },
      });
    }

    throw new ForbiddenException('No permission to view attendance');
  }
}
