import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { PlatformPrismaService } from '../common/prisma/platform-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateExamSubjectDto } from './dto/create-exam-subject.dto';
import { EnterMarksDto } from './dto/enter-marks.dto';
import { RejectExamSubjectDto } from './dto/reject-exam-subject.dto';
import { renderReportCardPdf } from './report-card-pdf.util';
import { buildWorkbook, ExcelColumn } from '../common/excel/excel-builder.util';
import { parseWorkbook, RowError } from '../common/excel/excel-parser.util';
import { MARKS_IMPORT_INSTRUCTIONS } from './marks-import-instructions';

const RUBRIC_LEVELS = ['EE', 'ME', 'AE', 'BE'];

interface MarkExportRow {
  student: { admissionNumber: string };
  score: number | null;
  rubricLevel: string | null;
  comment: string | null;
}

@Injectable()
export class ExamsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly platformPrisma: PlatformPrismaService,
  ) {}

  async createExam(user: JwtUserPayload, dto: CreateExamDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.exam.create({
      data: {
        name: dto.name,
        examType: dto.examType,
        academicYearId: dto.academicYearId,
        term: dto.term,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
  }

  async listExams(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.exam.findMany({
      include: { academicYear: true, examSubjects: { include: { subject: true, schoolClass: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  async createExamSubject(user: JwtUserPayload, examId: string, dto: CreateExamSubjectDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const exam = await db.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException('Exam not found');

    return db.examSubject.create({
      data: {
        examId,
        subjectId: dto.subjectId,
        classId: dto.classId,
        maxScore: dto.maxScore ?? 100,
        scoringMode: dto.scoringMode ?? 'NUMERIC',
      },
      include: { subject: true, schoolClass: true },
    });
  }

  /** School Administrator (EXAM:MANAGE/APPROVE) sees everything; a subject teacher sees only the
   * exam-subjects they're assigned to (so they know what to grade), scoped like attendance/homework. */
  async listExamSubjects(user: JwtUserPayload, examId?: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];
    const where: Record<string, unknown> = {};
    if (examId) where.examId = examId;

    if (perms.includes('EXAM:MANAGE') || perms.includes('EXAM:APPROVE')) {
      return db.examSubject.findMany({
        where,
        include: { subject: true, schoolClass: true, exam: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    const myAssignments = await db.subjectAssignment.findMany({ where: { teacherId: user.sub } });
    const pairs = myAssignments.map((a) => ({ subjectId: a.subjectId, classId: a.classId }));
    if (pairs.length === 0) return [];

    return db.examSubject.findMany({
      where: { ...where, OR: pairs.map((p) => ({ subjectId: p.subjectId, classId: p.classId })) },
      include: { subject: true, schoolClass: true, exam: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertCanEnterMarks(user: JwtUserPayload, examSubject: { subjectId: string; classId: string }) {
    const perms = user.permissions ?? [];
    if (perms.includes('EXAM:MANAGE')) return;
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const assignment = await db.subjectAssignment.findFirst({
      where: { teacherId: user.sub, subjectId: examSubject.subjectId, classId: examSubject.classId },
    });
    if (!assignment) {
      throw new ForbiddenException('You are not the assigned teacher for this subject and class');
    }
  }

  async enterMarks(user: JwtUserPayload, examSubjectId: string, dto: EnterMarksDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const examSubject = await db.examSubject.findUnique({ where: { id: examSubjectId } });
    if (!examSubject) throw new NotFoundException('Exam subject not found');
    if (examSubject.status !== 'DRAFT') {
      throw new BadRequestException('Marks are locked. Ask a School Administrator to reopen this exam subject.');
    }
    await this.assertCanEnterMarks(user, examSubject);

    return db.$transaction(
      dto.entries.map((entry) =>
        db.mark.upsert({
          where: { examSubjectId_studentId: { examSubjectId, studentId: entry.studentId } },
          update: { score: entry.score, rubricLevel: entry.rubricLevel, comment: entry.comment, enteredByUserId: user.sub },
          create: {
            examSubjectId,
            studentId: entry.studentId,
            score: entry.score,
            rubricLevel: entry.rubricLevel,
            comment: entry.comment,
            enteredByUserId: user.sub,
          },
        }),
      ),
    );
  }

  async getMarks(user: JwtUserPayload, examSubjectId: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const examSubject = await db.examSubject.findUnique({ where: { id: examSubjectId } });
    if (!examSubject) throw new NotFoundException('Exam subject not found');

    const perms = user.permissions ?? [];
    if (!perms.includes('EXAM:MANAGE') && !perms.includes('EXAM:APPROVE')) {
      await this.assertCanEnterMarks(user, examSubject);
    }

    return db.mark.findMany({ where: { examSubjectId }, include: { student: true } });
  }

  // ---- Excel import/export — scoped to one exam subject, see docs/IMPORT_EXPORT.md ----

  private markColumns(): ExcelColumn<MarkExportRow>[] {
    return [
      { header: 'Admission Number', key: 'admissionNumber', required: true, getValue: (r) => r.student.admissionNumber },
      { header: 'Score', key: 'score', getValue: (r) => r.score },
      { header: 'Rubric Level', key: 'rubricLevel', dropdown: RUBRIC_LEVELS, getValue: (r) => r.rubricLevel },
      { header: 'Comment', key: 'comment', getValue: (r) => r.comment },
    ];
  }

  async exportMarksExcel(user: JwtUserPayload, examSubjectId: string): Promise<Buffer> {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const examSubject = await db.examSubject.findUnique({ where: { id: examSubjectId } });
    if (!examSubject) throw new NotFoundException('Exam subject not found');
    const marks = await db.mark.findMany({ where: { examSubjectId }, include: { student: true } });
    return buildWorkbook({ sheetName: 'Marks', columns: this.markColumns(), rows: marks });
  }

  async importMarksTemplateExcel(): Promise<Buffer> {
    return buildWorkbook({
      sheetName: 'Marks',
      columns: this.markColumns(),
      rows: [],
      instructions: MARKS_IMPORT_INSTRUCTIONS,
    });
  }

  async importMarksFromExcel(user: JwtUserPayload, examSubjectId: string, buffer: Buffer) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const examSubject = await db.examSubject.findUnique({ where: { id: examSubjectId } });
    if (!examSubject) throw new NotFoundException('Exam subject not found');
    if (examSubject.status !== 'DRAFT') {
      throw new BadRequestException('Marks are locked. Ask a School Administrator to reopen this exam subject.');
    }
    await this.assertCanEnterMarks(user, examSubject);

    const columns = this.markColumns();
    const { rows, headerErrors } = await parseWorkbook(buffer, columns.map((c) => ({ header: c.header, key: c.key })));
    if (headerErrors.length > 0) return { created: 0, updated: 0, errors: headerErrors };

    const errors: RowError[] = [];
    const seenAdmissionNumbers = new Map<string, number[]>();
    for (const row of rows) {
      const key = String(row.data.admissionNumber ?? '').trim();
      if (!key) continue;
      seenAdmissionNumbers.set(key, [...(seenAdmissionNumbers.get(key) ?? []), row.rowNumber]);
    }
    for (const [key, rowNumbers] of seenAdmissionNumbers) {
      if (rowNumbers.length > 1) {
        for (const rn of rowNumbers) {
          errors.push({ row: rn, field: 'admissionNumber', message: `Admission number ${key} appears on rows ${rowNumbers.join(', ')} — fix duplicates before importing.` });
        }
      }
    }

    type Planned = { row: number; studentId: string; score: number | null; rubricLevel: string | null; comment: string | null };
    const planned: Planned[] = [];

    for (const row of rows) {
      const admissionNumber = String(row.data.admissionNumber ?? '').trim();
      if ((seenAdmissionNumbers.get(admissionNumber)?.length ?? 0) > 1) continue;

      if (!admissionNumber) {
        errors.push({ row: row.rowNumber, field: 'admissionNumber', message: 'Admission Number is required.' });
        continue;
      }
      const student = await db.student.findUnique({ where: { admissionNumber } });
      if (!student) {
        errors.push({ row: row.rowNumber, field: 'admissionNumber', message: `No student with admission number "${admissionNumber}".` });
        continue;
      }

      let score: number | null = null;
      let rubricLevel: string | null = null;

      if (examSubject.scoringMode === 'NUMERIC') {
        const scoreRaw = row.data.score;
        if (scoreRaw === null || scoreRaw === undefined || scoreRaw === '') {
          errors.push({ row: row.rowNumber, field: 'score', message: 'Score is required for this NUMERIC-scored subject.' });
        } else {
          const parsed = Number(scoreRaw);
          if (!Number.isInteger(parsed) || parsed < 0 || parsed > examSubject.maxScore) {
            errors.push({ row: row.rowNumber, field: 'score', message: `Score must be a whole number between 0 and ${examSubject.maxScore}, got "${scoreRaw}".` });
          } else {
            score = parsed;
          }
        }
      } else {
        const rubricRaw = String(row.data.rubricLevel ?? '').trim().toUpperCase();
        if (!rubricRaw) {
          errors.push({ row: row.rowNumber, field: 'rubricLevel', message: 'Rubric Level is required for this RUBRIC-scored subject.' });
        } else if (!RUBRIC_LEVELS.includes(rubricRaw)) {
          errors.push({ row: row.rowNumber, field: 'rubricLevel', message: `Rubric Level must be one of ${RUBRIC_LEVELS.join(', ')}, got "${rubricRaw}".` });
        } else {
          rubricLevel = rubricRaw;
        }
      }

      const comment = row.data.comment ? String(row.data.comment) : null;

      if ((examSubject.scoringMode === 'NUMERIC' && score !== null) || (examSubject.scoringMode === 'RUBRIC' && rubricLevel !== null)) {
        planned.push({ row: row.rowNumber, studentId: student.id, score, rubricLevel, comment });
      }
    }

    if (errors.length > 0) return { created: 0, updated: 0, errors };

    let created = 0;
    let updated = 0;
    await db.$transaction(async (tx) => {
      for (const p of planned) {
        const existed = await tx.mark.findUnique({ where: { examSubjectId_studentId: { examSubjectId, studentId: p.studentId } } });
        await tx.mark.upsert({
          where: { examSubjectId_studentId: { examSubjectId, studentId: p.studentId } },
          update: { score: p.score, rubricLevel: p.rubricLevel as never, comment: p.comment, enteredByUserId: user.sub },
          create: { examSubjectId, studentId: p.studentId, score: p.score, rubricLevel: p.rubricLevel as never, comment: p.comment, enteredByUserId: user.sub },
        });
        if (existed) updated++;
        else created++;
      }
    });

    return { created, updated, errors: [] };
  }

  async submit(user: JwtUserPayload, examSubjectId: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const examSubject = await db.examSubject.findUnique({ where: { id: examSubjectId } });
    if (!examSubject) throw new NotFoundException('Exam subject not found');
    if (examSubject.status !== 'DRAFT') throw new BadRequestException('Only draft exam subjects can be submitted');
    await this.assertCanEnterMarks(user, examSubject);

    const updated = await db.examSubject.update({ where: { id: examSubjectId }, data: { status: 'SUBMITTED' } });
    await db.auditLog.create({
      data: { actorUserId: user.sub, action: 'EXAM_MARKS_SUBMITTED', entityType: 'ExamSubject', entityId: examSubjectId },
    });
    return updated;
  }

  async approve(user: JwtUserPayload, examSubjectId: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const examSubject = await db.examSubject.findUnique({ where: { id: examSubjectId } });
    if (!examSubject) throw new NotFoundException('Exam subject not found');
    if (examSubject.status !== 'SUBMITTED') throw new BadRequestException('Only submitted exam subjects can be approved');

    const updated = await db.examSubject.update({
      where: { id: examSubjectId },
      data: { status: 'APPROVED', reviewComment: null },
    });
    await db.auditLog.create({
      data: { actorUserId: user.sub, action: 'EXAM_MARKS_APPROVED', entityType: 'ExamSubject', entityId: examSubjectId },
    });
    return updated;
  }

  async reject(user: JwtUserPayload, examSubjectId: string, dto: RejectExamSubjectDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const examSubject = await db.examSubject.findUnique({ where: { id: examSubjectId } });
    if (!examSubject) throw new NotFoundException('Exam subject not found');
    if (examSubject.status !== 'SUBMITTED') throw new BadRequestException('Only submitted exam subjects can be rejected');

    const updated = await db.examSubject.update({
      where: { id: examSubjectId },
      data: { status: 'DRAFT', reviewComment: dto.comment ?? 'Returned for correction' },
    });
    await db.auditLog.create({
      data: {
        actorUserId: user.sub,
        action: 'EXAM_MARKS_REJECTED',
        entityType: 'ExamSubject',
        entityId: examSubjectId,
        newValue: { comment: dto.comment },
      },
    });
    return updated;
  }

  async reopen(user: JwtUserPayload, examSubjectId: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const examSubject = await db.examSubject.findUnique({ where: { id: examSubjectId } });
    if (!examSubject) throw new NotFoundException('Exam subject not found');
    if (examSubject.status !== 'APPROVED') throw new BadRequestException('Only approved exam subjects can be reopened');

    const updated = await db.examSubject.update({ where: { id: examSubjectId }, data: { status: 'DRAFT' } });
    await db.auditLog.create({
      data: { actorUserId: user.sub, action: 'EXAM_MARKS_REOPENED', entityType: 'ExamSubject', entityId: examSubjectId },
    });
    return updated;
  }

  /** Report card: every APPROVED mark for a student within one exam. Scoped the same way as
   * Attendance/Homework — a Parent/Student never sees a DRAFT/SUBMITTED (unapproved) mark. */
  private async assertCanViewReportCard(user: JwtUserPayload, studentId: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];

    if (perms.includes('EXAM:MANAGE') || perms.includes('EXAM:APPROVE')) return;

    const student = await db.student.findFirst({
      where: {
        id: studentId,
        OR: [
          { userId: perms.includes('STUDENT:VIEW_OWN_RECORD') ? user.sub : undefined },
          perms.includes('STUDENT:VIEW_OWN_CHILD')
            ? { guardians: { some: { guardianUserId: user.sub } } }
            : undefined,
        ].filter(Boolean) as object[],
      },
    });
    if (!student) throw new ForbiddenException('No permission to view this report card');
  }

  private async getApprovedMarks(user: JwtUserPayload, examId: string, studentId: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.mark.findMany({
      where: { studentId, examSubject: { examId, status: 'APPROVED' } },
      include: { examSubject: { include: { subject: true } } },
    });
  }

  async reportCard(user: JwtUserPayload, examId: string, studentId: string) {
    await this.assertCanViewReportCard(user, studentId);
    const marks = await this.getApprovedMarks(user, examId, studentId);

    return marks.map((m) => ({
      subject: m.examSubject.subject.name,
      maxScore: m.examSubject.maxScore,
      score: m.score,
      rubricLevel: m.rubricLevel,
      comment: m.comment,
    }));
  }

  async reportCardPdf(
    user: JwtUserPayload,
    examId: string,
    studentId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    await this.assertCanViewReportCard(user, studentId);
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);

    const [marks, student, exam, tenant] = await Promise.all([
      this.getApprovedMarks(user, examId, studentId),
      db.student.findUnique({ where: { id: studentId }, include: { gradeLevel: true, currentClass: true } }),
      db.exam.findUnique({ where: { id: examId } }),
      this.platformPrisma.tenant.findFirst({ where: { schemaName: user.tenantSchema! } }),
    ]);
    if (!student) throw new NotFoundException('Student not found');
    if (!exam) throw new NotFoundException('Exam not found');

    const buffer = await renderReportCardPdf({
      school: {
        name: tenant?.name ?? user.tenantSlug ?? 'School',
        logoUrl: tenant?.logoUrl ?? null,
        mission: tenant?.mission ?? null,
        vision: tenant?.vision ?? null,
        motto: tenant?.motto ?? null,
        address: tenant?.address ?? null,
        passMarkPercent: tenant?.passMarkPercent ?? 50,
      },
      student: {
        firstName: student.firstName,
        lastName: student.lastName,
        admissionNumber: student.admissionNumber,
        photoUrl: student.photoUrl,
        gradeLevelName: student.gradeLevel.name,
        className: student.currentClass?.name ?? null,
      },
      exam: { name: exam.name, examType: exam.examType, term: exam.term },
      marks: marks.map((m) => ({
        subject: m.examSubject.subject.name,
        maxScore: m.examSubject.maxScore,
        score: m.score,
        rubricLevel: m.rubricLevel,
        comment: m.comment,
      })),
      generatedAt: new Date(),
    });

    const slug = (s: string) => s.trim().replace(/[^a-zA-Z0-9]+/g, '');
    const filename = `${slug(student.lastName)}_${slug(student.firstName)}_${slug(exam.name)}_Term${exam.term}_ReportCard.pdf`;

    return { buffer, filename };
  }
}
