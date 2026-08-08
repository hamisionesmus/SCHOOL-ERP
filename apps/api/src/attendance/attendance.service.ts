import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { ReopenAttendanceDto } from './dto/reopen-attendance.dto';
import { buildWorkbook, ExcelColumn } from '../common/excel/excel-builder.util';
import { parseWorkbook, RowError } from '../common/excel/excel-parser.util';
import { ATTENDANCE_IMPORT_INSTRUCTIONS } from './attendance-import-instructions';

const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

interface AttendanceExportRow {
  student: { admissionNumber: string };
  schoolClass: { name: string };
  date: Date;
  status: string;
}

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

  // ---- Excel import/export — see docs/IMPORT_EXPORT.md ----

  private attendanceColumns(): ExcelColumn<AttendanceExportRow>[] {
    return [
      { header: 'Admission Number', key: 'admissionNumber', required: true, getValue: (r) => r.student.admissionNumber },
      { header: 'Class Name', key: 'className', required: true, getValue: (r) => r.schoolClass.name },
      { header: 'Date (YYYY-MM-DD)', key: 'date', required: true, getValue: (r) => r.date.toISOString().slice(0, 10) },
      { header: 'Status', key: 'status', required: true, dropdown: ATTENDANCE_STATUSES, getValue: (r) => r.status },
    ];
  }

  async exportExcel(user: JwtUserPayload): Promise<Buffer> {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const records = await db.attendanceRecord.findMany({
      include: { student: true, schoolClass: true },
      orderBy: { date: 'desc' },
    });
    return buildWorkbook({ sheetName: 'Attendance', columns: this.attendanceColumns(), rows: records });
  }

  async importTemplateExcel(): Promise<Buffer> {
    return buildWorkbook({
      sheetName: 'Attendance',
      columns: this.attendanceColumns(),
      rows: [],
      instructions: ATTENDANCE_IMPORT_INSTRUCTIONS,
    });
  }

  async importFromExcel(user: JwtUserPayload, buffer: Buffer) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const columns = this.attendanceColumns();
    const { rows, headerErrors } = await parseWorkbook(buffer, columns.map((c) => ({ header: c.header, key: c.key })));
    if (headerErrors.length > 0) return { created: 0, updated: 0, errors: headerErrors };

    const errors: RowError[] = [];
    const currentClasses = await db.schoolClass.findMany({ where: { academicYear: { isCurrent: true } } });
    const classByName = new Map(currentClasses.map((c) => [c.name, c]));

    type Planned = { row: number; studentId: string; classId: string; date: Date; status: string };
    const planned: Planned[] = [];
    const seenTriples = new Map<string, number[]>();
    const lockedPairsCache = new Map<string, boolean>();

    for (const row of rows) {
      const admissionNumber = String(row.data.admissionNumber ?? '').trim();
      const className = String(row.data.className ?? '').trim();
      const dateRaw = row.data.date;
      const statusRaw = String(row.data.status ?? '').trim().toUpperCase();

      if (!admissionNumber) {
        errors.push({ row: row.rowNumber, field: 'admissionNumber', message: 'Admission Number is required.' });
        continue;
      }
      const student = await db.student.findUnique({ where: { admissionNumber } });
      if (!student) {
        errors.push({ row: row.rowNumber, field: 'admissionNumber', message: `No student with admission number "${admissionNumber}".` });
        continue;
      }

      if (!className) {
        errors.push({ row: row.rowNumber, field: 'className', message: 'Class Name is required.' });
        continue;
      }
      const schoolClass = classByName.get(className);
      if (!schoolClass) {
        errors.push({ row: row.rowNumber, field: 'className', message: `No class named "${className}" in the current academic year.` });
        continue;
      }

      let date: Date | undefined;
      if (dateRaw) {
        const parsed = toDateOnly(String(dateRaw).slice(0, 10));
        if (isNaN(parsed.getTime())) {
          errors.push({ row: row.rowNumber, field: 'date', message: `Invalid Date "${dateRaw}" — use YYYY-MM-DD.` });
        } else {
          date = parsed;
        }
      } else {
        errors.push({ row: row.rowNumber, field: 'date', message: 'Date is required.' });
      }

      if (!ATTENDANCE_STATUSES.includes(statusRaw)) {
        errors.push({ row: row.rowNumber, field: 'status', message: `Status must be one of ${ATTENDANCE_STATUSES.join(', ')}, got "${statusRaw}".` });
      }

      if (!date) continue;

      const lockKey = `${schoolClass.id}|${date.toISOString()}`;
      if (!lockedPairsCache.has(lockKey)) {
        const existing = await db.attendanceRecord.findFirst({ where: { classId: schoolClass.id, date }, select: { locked: true } });
        lockedPairsCache.set(lockKey, !!existing?.locked);
      }
      if (lockedPairsCache.get(lockKey)) {
        errors.push({
          row: row.rowNumber,
          field: 'date',
          message: `Attendance for class "${className}" on ${date.toISOString().slice(0, 10)} is already submitted and locked — ask a School Administrator to reopen it first.`,
        });
        continue;
      }

      const tripleKey = `${student.id}|${schoolClass.id}|${date.toISOString()}`;
      seenTriples.set(tripleKey, [...(seenTriples.get(tripleKey) ?? []), row.rowNumber]);

      if (ATTENDANCE_STATUSES.includes(statusRaw)) {
        planned.push({ row: row.rowNumber, studentId: student.id, classId: schoolClass.id, date, status: statusRaw });
      }
    }

    for (const [, rowNumbers] of seenTriples) {
      if (rowNumbers.length > 1) {
        for (const rn of rowNumbers) {
          errors.push({ row: rn, message: `This student/class/date combination appears on rows ${rowNumbers.join(', ')} — remove the duplicate before importing.` });
        }
      }
    }

    if (errors.length > 0) return { created: 0, updated: 0, errors };

    let created = 0;
    let updated = 0;
    await db.$transaction(async (tx) => {
      for (const p of planned) {
        const existed = await tx.attendanceRecord.findUnique({
          where: { studentId_classId_date: { studentId: p.studentId, classId: p.classId, date: p.date } },
        });
        await tx.attendanceRecord.upsert({
          where: { studentId_classId_date: { studentId: p.studentId, classId: p.classId, date: p.date } },
          update: { status: p.status as never, markedByUserId: user.sub, locked: true },
          create: { studentId: p.studentId, classId: p.classId, date: p.date, status: p.status as never, markedByUserId: user.sub, locked: true },
        });
        if (existed) updated++;
        else created++;
      }
      if (planned.length > 0) {
        await tx.auditLog.create({
          data: {
            actorUserId: user.sub,
            action: 'ATTENDANCE_IMPORTED',
            entityType: 'AttendanceRecord',
            entityId: 'bulk-import',
            newValue: planned as unknown as object,
          },
        });
      }
    });

    return { created, updated, errors: [] };
  }
}
