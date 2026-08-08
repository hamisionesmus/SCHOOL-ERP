import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { UserDirectoryService } from '../common/user-directory/user-directory.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { AddGuardianDto } from './dto/add-guardian.dto';
import { generateAdmissionNumber } from './admission-number.util';
import { buildWorkbook, ExcelColumn } from '../common/excel/excel-builder.util';
import { parseWorkbook, RowError } from '../common/excel/excel-parser.util';
import { STUDENT_IMPORT_INSTRUCTIONS } from './students-import-instructions';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const STUDENT_STATUSES = ['ACTIVE', 'TRANSFERRED', 'GRADUATED', 'WITHDRAWN'];

interface StudentExportRow {
  admissionNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: string;
  gradeLevel: { code: string };
  currentClass: { name: string } | null;
  upiNumber: string | null;
  nemisNumber: string | null;
  addressLine: string | null;
  landmark: string | null;
  status: string;
}

@Injectable()
export class StudentsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly userDirectory: UserDirectoryService,
  ) {}

  /**
   * A student's own record, a parent's children, or (with STUDENT:VIEW) the full roster —
   * scoping happens here rather than at the guard because it depends on *which* rows, not
   * just whether the route is allowed. See docs/RBAC.md §3.
   */
  async list(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];

    if (perms.includes('STUDENT:VIEW')) {
      return db.student.findMany({
        where: { deletedAt: null },
        include: { gradeLevel: true, currentClass: true },
        orderBy: { admissionNumber: 'asc' },
      });
    }

    if (perms.includes('STUDENT:VIEW_OWN_CHILD')) {
      return db.student.findMany({
        where: { deletedAt: null, guardians: { some: { guardianUserId: user.sub } } },
        include: { gradeLevel: true, currentClass: true },
      });
    }

    if (perms.includes('STUDENT:VIEW_OWN_RECORD')) {
      return db.student.findMany({
        where: { deletedAt: null, userId: user.sub },
        include: { gradeLevel: true, currentClass: true },
      });
    }

    throw new ForbiddenException('No permission to view students');
  }

  async findOne(user: JwtUserPayload, id: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const student = await db.student.findFirst({
      where: { id, deletedAt: null },
      include: {
        gradeLevel: true,
        currentClass: true,
        guardians: { include: { guardianUser: { select: { id: true, fullName: true, email: true, phone: true } } } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const perms = user.permissions ?? [];
    const isOwnRecord = perms.includes('STUDENT:VIEW_OWN_RECORD') && student.userId === user.sub;
    const isOwnChild =
      perms.includes('STUDENT:VIEW_OWN_CHILD') &&
      student.guardians.some((g) => g.guardianUserId === user.sub);
    if (!perms.includes('STUDENT:VIEW') && !isOwnRecord && !isOwnChild) {
      throw new ForbiddenException('No permission to view this student');
    }
    return student;
  }

  async create(user: JwtUserPayload, dto: CreateStudentDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const admissionNumber = await generateAdmissionNumber(db);

    return db.student.create({
      data: {
        admissionNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        gradeLevelId: dto.gradeLevelId,
        currentClassId: dto.currentClassId,
        upiNumber: dto.upiNumber,
        nemisNumber: dto.nemisNumber,
        addressLine: dto.addressLine,
        landmark: dto.landmark,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
      include: { gradeLevel: true, currentClass: true },
    });
  }

  async update(user: JwtUserPayload, studentId: string, dto: UpdateStudentDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const student = await db.student.findFirst({ where: { id: studentId, deletedAt: null } });
    if (!student) throw new NotFoundException('Student not found');

    const { dateOfBirth, ...rest } = dto;
    return db.student.update({
      where: { id: studentId },
      data: { ...rest, ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}) },
      include: { gradeLevel: true, currentClass: true },
    });
  }

  async addGuardian(user: JwtUserPayload, studentId: string, dto: AddGuardianDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const student = await db.student.findFirst({ where: { id: studentId, deletedAt: null } });
    if (!student) throw new NotFoundException('Student not found');

    let guardianUserId = dto.guardianUserId;
    if (!guardianUserId) {
      if (!dto.guardianEmail || !dto.guardianFullName) {
        throw new ForbiddenException('Provide either guardianUserId or guardianEmail + guardianFullName');
      }
      await this.userDirectory.reserveForSchema(dto.guardianEmail, user.tenantSchema!);
      // Temp password: the guardian portal's own password-reset flow (Phase 3+) is how they'll first
      // sign in; this just satisfies the not-null constraint without anyone knowing this value.
      const passwordHash = await bcrypt.hash(randomUUID(), 12);
      const guardianUser = await db.user.upsert({
        where: { email: dto.guardianEmail },
        update: {},
        create: { email: dto.guardianEmail, fullName: dto.guardianFullName, passwordHash },
      });
      const parentRole = await db.role.findUnique({ where: { name: 'Parent' } });
      if (parentRole) {
        await db.userRole.upsert({
          where: { userId_roleId: { userId: guardianUser.id, roleId: parentRole.id } },
          update: {},
          create: { userId: guardianUser.id, roleId: parentRole.id },
        });
      }
      guardianUserId = guardianUser.id;
    }

    return db.guardianLink.upsert({
      where: { studentId_guardianUserId: { studentId, guardianUserId } },
      update: { relationship: dto.relationship, isPrimaryContact: dto.isPrimaryContact ?? false },
      create: {
        studentId,
        guardianUserId,
        relationship: dto.relationship,
        isPrimaryContact: dto.isPrimaryContact ?? false,
      },
      include: { guardianUser: { select: { id: true, fullName: true, email: true, phone: true } } },
    });
  }

  // ---- Excel import/export — see docs/IMPORT_EXPORT.md ----

  private studentColumns(gradeLevelCodes: string[]): ExcelColumn<StudentExportRow>[] {
    return [
      { header: 'Admission Number', key: 'admissionNumber', getValue: (r) => r.admissionNumber },
      { header: 'First Name', key: 'firstName', required: true, getValue: (r) => r.firstName },
      { header: 'Last Name', key: 'lastName', required: true, getValue: (r) => r.lastName },
      {
        header: 'Date of Birth (YYYY-MM-DD)',
        key: 'dateOfBirth',
        required: true,
        getValue: (r) => r.dateOfBirth.toISOString().slice(0, 10),
      },
      { header: 'Gender', key: 'gender', required: true, dropdown: ['MALE', 'FEMALE'], getValue: (r) => r.gender },
      {
        header: 'Grade Level Code',
        key: 'gradeLevelCode',
        required: true,
        dropdown: gradeLevelCodes,
        getValue: (r) => r.gradeLevel.code,
      },
      { header: 'Current Class Name', key: 'currentClassName', getValue: (r) => r.currentClass?.name ?? null },
      { header: 'UPI Number', key: 'upiNumber', getValue: (r) => r.upiNumber },
      { header: 'NEMIS Number', key: 'nemisNumber', getValue: (r) => r.nemisNumber },
      { header: 'Address Line', key: 'addressLine', getValue: (r) => r.addressLine },
      { header: 'Landmark', key: 'landmark', getValue: (r) => r.landmark },
      { header: 'Status', key: 'status', dropdown: STUDENT_STATUSES, getValue: (r) => r.status },
    ];
  }

  async exportExcel(user: JwtUserPayload): Promise<Buffer> {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const [students, gradeLevels] = await Promise.all([
      db.student.findMany({
        where: { deletedAt: null },
        include: { gradeLevel: true, currentClass: true },
        orderBy: { admissionNumber: 'asc' },
      }),
      db.gradeLevel.findMany({ select: { code: true } }),
    ]);
    return buildWorkbook({
      sheetName: 'Students',
      columns: this.studentColumns(gradeLevels.map((g) => g.code)),
      rows: students,
    });
  }

  async importTemplateExcel(user: JwtUserPayload): Promise<Buffer> {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const gradeLevels = await db.gradeLevel.findMany({ select: { code: true } });
    return buildWorkbook({
      sheetName: 'Students',
      columns: this.studentColumns(gradeLevels.map((g) => g.code)),
      rows: [],
      instructions: STUDENT_IMPORT_INSTRUCTIONS,
    });
  }

  async importFromExcel(user: JwtUserPayload, buffer: Buffer) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const gradeLevels = await db.gradeLevel.findMany();
    const columns = this.studentColumns(gradeLevels.map((g) => g.code));
    const { rows, headerErrors } = await parseWorkbook(buffer, columns.map((c) => ({ header: c.header, key: c.key })));
    if (headerErrors.length > 0) return { created: 0, updated: 0, errors: headerErrors };

    const errors: RowError[] = [];
    const seenKeys = new Map<string, number[]>();
    for (const row of rows) {
      const key = String(row.data.admissionNumber ?? '').trim();
      if (!key) continue;
      seenKeys.set(key, [...(seenKeys.get(key) ?? []), row.rowNumber]);
    }
    for (const [key, rowNumbers] of seenKeys) {
      if (rowNumbers.length > 1) {
        for (const rn of rowNumbers) {
          errors.push({ row: rn, field: 'admissionNumber', message: `Admission number ${key} appears on rows ${rowNumbers.join(', ')} — fix duplicates before importing.` });
        }
      }
    }

    const gradeLevelByCode = new Map(gradeLevels.map((g) => [g.code, g]));
    const currentClasses = await db.schoolClass.findMany({ where: { academicYear: { isCurrent: true } } });
    const classByName = new Map(currentClasses.map((c) => [c.name, c]));

    type Planned = { row: number; isUpdate: boolean; existingId?: string; data: Record<string, unknown> };
    const planned: Planned[] = [];

    for (const row of rows) {
      const admissionNumber = String(row.data.admissionNumber ?? '').trim();
      if ((seenKeys.get(admissionNumber)?.length ?? 0) > 1) continue; // already flagged as duplicate

      const existing = admissionNumber
        ? await db.student.findUnique({ where: { admissionNumber } })
        : null;
      if (admissionNumber && !existing) {
        errors.push({ row: row.rowNumber, field: 'admissionNumber', message: `No existing student with admission number ${admissionNumber} — leave blank to create a new student instead.` });
        continue;
      }

      const firstName = String(row.data.firstName ?? '').trim();
      const lastName = String(row.data.lastName ?? '').trim();
      const dobRaw = row.data.dateOfBirth;
      const genderRaw = String(row.data.gender ?? '').trim().toUpperCase();
      const gradeLevelCodeRaw = String(row.data.gradeLevelCode ?? '').trim();
      const currentClassNameRaw = String(row.data.currentClassName ?? '').trim();
      const statusRaw = String(row.data.status ?? '').trim().toUpperCase();

      if (!existing) {
        if (!firstName) errors.push({ row: row.rowNumber, field: 'firstName', message: 'First Name is required for a new student.' });
        if (!lastName) errors.push({ row: row.rowNumber, field: 'lastName', message: 'Last Name is required for a new student.' });
      }

      let dateOfBirth: Date | undefined;
      if (dobRaw) {
        const parsed = new Date(dobRaw);
        if (isNaN(parsed.getTime())) {
          errors.push({ row: row.rowNumber, field: 'dateOfBirth', message: `Invalid Date of Birth "${dobRaw}" — use YYYY-MM-DD.` });
        } else {
          dateOfBirth = parsed;
        }
      } else if (!existing) {
        errors.push({ row: row.rowNumber, field: 'dateOfBirth', message: 'Date of Birth is required for a new student.' });
      }

      let gender: string | undefined;
      if (genderRaw) {
        if (genderRaw !== 'MALE' && genderRaw !== 'FEMALE') {
          errors.push({ row: row.rowNumber, field: 'gender', message: `Gender must be MALE or FEMALE, got "${genderRaw}".` });
        } else {
          gender = genderRaw;
        }
      } else if (!existing) {
        errors.push({ row: row.rowNumber, field: 'gender', message: 'Gender is required for a new student.' });
      }

      let gradeLevelId: string | undefined;
      if (gradeLevelCodeRaw) {
        const gl = gradeLevelByCode.get(gradeLevelCodeRaw);
        if (!gl) {
          errors.push({ row: row.rowNumber, field: 'gradeLevelCode', message: `No grade level with code "${gradeLevelCodeRaw}" — valid codes: ${[...gradeLevelByCode.keys()].join(', ')}.` });
        } else {
          gradeLevelId = gl.id;
        }
      } else if (!existing) {
        errors.push({ row: row.rowNumber, field: 'gradeLevelCode', message: 'Grade Level Code is required for a new student.' });
      }

      let currentClassId: string | null | undefined;
      if (currentClassNameRaw) {
        const cls = classByName.get(currentClassNameRaw);
        if (!cls) {
          errors.push({ row: row.rowNumber, field: 'currentClassName', message: `No class named "${currentClassNameRaw}" in the current academic year.` });
        } else {
          currentClassId = cls.id;
        }
      }

      let status: string | undefined;
      if (statusRaw) {
        if (!STUDENT_STATUSES.includes(statusRaw)) {
          errors.push({ row: row.rowNumber, field: 'status', message: `Status must be one of ${STUDENT_STATUSES.join(', ')}, got "${statusRaw}".` });
        } else {
          status = statusRaw;
        }
      }

      planned.push({
        row: row.rowNumber,
        isUpdate: !!existing,
        existingId: existing?.id,
        data: {
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
          ...(dateOfBirth ? { dateOfBirth } : {}),
          ...(gender ? { gender } : {}),
          ...(gradeLevelId ? { gradeLevelId } : {}),
          ...(currentClassId !== undefined ? { currentClassId } : {}),
          ...(row.data.upiNumber ? { upiNumber: String(row.data.upiNumber) } : {}),
          ...(row.data.nemisNumber ? { nemisNumber: String(row.data.nemisNumber) } : {}),
          ...(row.data.addressLine ? { addressLine: String(row.data.addressLine) } : {}),
          ...(row.data.landmark ? { landmark: String(row.data.landmark) } : {}),
          ...(status ? { status } : {}),
        },
      });
    }

    if (errors.length > 0) return { created: 0, updated: 0, errors };

    let created = 0;
    let updated = 0;
    await db.$transaction(async (tx) => {
      for (const p of planned) {
        if (p.isUpdate && p.existingId) {
          await tx.student.update({ where: { id: p.existingId }, data: p.data });
          updated++;
        } else {
          await tx.student.create({
            data: {
              admissionNumber: await generateAdmissionNumber(tx as never),
              firstName: p.data.firstName as string,
              lastName: p.data.lastName as string,
              dateOfBirth: p.data.dateOfBirth as Date,
              gender: p.data.gender as string,
              gradeLevelId: p.data.gradeLevelId as string,
              currentClassId: (p.data.currentClassId as string | null) ?? undefined,
              upiNumber: p.data.upiNumber as string | undefined,
              nemisNumber: p.data.nemisNumber as string | undefined,
              addressLine: p.data.addressLine as string | undefined,
              landmark: p.data.landmark as string | undefined,
              status: (p.data.status as string | undefined) as never,
            },
          });
          created++;
        }
      }
    });

    return { created, updated, errors: [] };
  }
}
