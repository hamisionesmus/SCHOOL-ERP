import { Injectable, Logger } from '@nestjs/common';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { FinanceService } from '../../finance/finance.service';
import { AttendanceService } from '../../attendance/attendance.service';
import { ExamsService } from '../../exams/exams.service';
import { HomeworkService } from '../../homework/homework.service';
import { HrService } from '../../hr/hr.service';

interface LinkedStudent {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  className: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function nairobiToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
}

/**
 * Every method here is a "tool" Claude can invoke via the WhatsApp assistant (see
 * WhatsAppClaudeProvider) — Claude never touches the database directly, it can only call one of
 * these fixed, read-only functions and gets back plain JSON. Every method independently re-derives
 * which student(s)/records the sender (already identified by phone number, never trusted from
 * anything Claude supplies) is actually allowed to see, reusing the exact same guardian-link /
 * self-record permission checks the web app's own controllers enforce — a tool call can never
 * return more than the equivalent authenticated HTTP request already would.
 */
@Injectable()
export class WhatsAppAssistantToolsService {
  private readonly logger = new Logger('WhatsAppAssistant');

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly financeService: FinanceService,
    private readonly attendanceService: AttendanceService,
    private readonly examsService: ExamsService,
    private readonly homeworkService: HomeworkService,
    private readonly hrService: HrService,
  ) {}

  async getLinkedStudents(user: JwtUserPayload): Promise<LinkedStudent[]> {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const students = await db.student.findMany({
      where: { OR: [{ guardians: { some: { guardianUserId: user.sub } } }, { userId: user.sub }] },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true, currentClass: { select: { name: true } } },
    });
    return students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      admissionNumber: s.admissionNumber,
      className: s.currentClass?.name ?? null,
    }));
  }

  private matchStudent(students: LinkedStudent[], nameHint?: string): { student?: LinkedStudent; error?: string } {
    if (students.length === 0) {
      return {
        error:
          'This WhatsApp number is not linked as a guardian to any student, and is not itself a student login. Ask the school administrator to add this number to the right profile.',
      };
    }
    if (students.length === 1) return { student: students[0] };
    const names = students.map((s) => `${s.firstName} ${s.lastName}`).join(', ');
    if (!nameHint) {
      return { error: `More than one child is linked to this number: ${names}. Ask again and include the child's name.` };
    }
    const needle = nameHint.trim().toLowerCase();
    const matches = students.filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(needle));
    if (matches.length === 1) return { student: matches[0] };
    if (matches.length === 0) {
      return { error: `No child matching "${nameHint}" found. Linked children: ${names}.` };
    }
    return { error: `More than one child matches "${nameHint}": ${matches.map((s) => `${s.firstName} ${s.lastName}`).join(', ')}. Be more specific.` };
  }

  async getFeeBalance(user: JwtUserPayload, args: { studentName?: string }) {
    const students = await this.getLinkedStudents(user);
    const { student, error } = this.matchStudent(students, args.studentName);
    if (error) return { error };

    try {
      const invoices = await this.financeService.listInvoices(user);
      const forStudent = invoices.filter((inv) => inv.studentId === student!.id);
      if (forStudent.length === 0) {
        return { student: `${student!.firstName} ${student!.lastName}`, message: 'No invoices found for this student.' };
      }
      return {
        student: `${student!.firstName} ${student!.lastName}`,
        totalOutstandingBalanceKes: forStudent.reduce((sum, inv) => sum + inv.balance, 0),
        invoices: forStudent.map((inv) => ({ term: inv.term, amountKes: inv.amount, balanceKes: inv.balance, status: inv.status, dueDate: inv.dueDate })),
      };
    } catch (err) {
      this.logger.error(`getFeeBalance failed: ${err instanceof Error ? err.message : String(err)}`);
      return { error: 'Could not retrieve fee information right now.' };
    }
  }

  async getAttendance(user: JwtUserPayload, args: { studentName?: string; date?: string }) {
    const students = await this.getLinkedStudents(user);
    const { student, error } = this.matchStudent(students, args.studentName);
    if (error) return { error };

    const wantsSpecificDate = args.date && DATE_RE.test(args.date);
    const date = wantsSpecificDate ? args.date : nairobiToday();

    try {
      // No specific/valid date -> fall back to the student's most recent history (a "this week"-ish
      // window) rather than a single day, since AttendanceService.list() only supports one exact
      // date at a time, not a range.
      const records = await this.attendanceService.list(user, undefined, wantsSpecificDate ? date : undefined);
      const forStudent = records
        .filter((r) => r.studentId === student!.id)
        .slice(0, 14)
        .map((r) => ({ date: r.date, status: r.status }));
      if (forStudent.length === 0) {
        return { student: `${student!.firstName} ${student!.lastName}`, message: wantsSpecificDate ? `No attendance record for ${date}.` : 'No attendance records found.' };
      }
      return { student: `${student!.firstName} ${student!.lastName}`, records: forStudent };
    } catch (err) {
      this.logger.error(`getAttendance failed: ${err instanceof Error ? err.message : String(err)}`);
      return { error: 'Could not retrieve attendance information right now.' };
    }
  }

  async getExamResults(user: JwtUserPayload, args: { studentName?: string; examName?: string }) {
    const students = await this.getLinkedStudents(user);
    const { student, error } = this.matchStudent(students, args.studentName);
    if (error) return { error };

    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const exam = args.examName
      ? await db.exam.findFirst({ where: { name: { contains: args.examName, mode: 'insensitive' } }, orderBy: { endDate: 'desc' } })
      : await db.exam.findFirst({ orderBy: { endDate: 'desc' } });

    if (!exam) {
      return args.examName ? { error: `No exam found matching "${args.examName}".` } : { student: `${student!.firstName} ${student!.lastName}`, message: 'No exams recorded yet.' };
    }

    try {
      const marks = await this.examsService.reportCard(user, exam.id, student!.id);
      if (marks.length === 0) {
        return { student: `${student!.firstName} ${student!.lastName}`, exam: exam.name, message: 'No approved results are available yet for this exam.' };
      }
      return { student: `${student!.firstName} ${student!.lastName}`, exam: exam.name, results: marks };
    } catch (err) {
      this.logger.error(`getExamResults failed: ${err instanceof Error ? err.message : String(err)}`);
      return { error: 'You do not have permission to view this report card.' };
    }
  }

  async getHomework(user: JwtUserPayload, args: { studentName?: string }) {
    const students = await this.getLinkedStudents(user);
    const { student, error } = this.matchStudent(students, args.studentName);
    if (error) return { error };

    try {
      const db = this.tenantPrisma.forSchema(user.tenantSchema!);
      const studentRow = await db.student.findUnique({ where: { id: student!.id }, select: { currentClassId: true } });
      const assignments = await this.homeworkService.list(user);
      const today = nairobiToday();
      const upcoming = assignments
        .filter((a) => a.classId === studentRow?.currentClassId && a.dueDate.toISOString().slice(0, 10) >= today)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
        .slice(0, 10)
        .map((a) => ({ title: a.title, description: a.description, dueDate: a.dueDate }));

      if (upcoming.length === 0) {
        return { student: `${student!.firstName} ${student!.lastName}`, message: 'No upcoming homework found.' };
      }
      return { student: `${student!.firstName} ${student!.lastName}`, homework: upcoming };
    } catch (err) {
      this.logger.error(`getHomework failed: ${err instanceof Error ? err.message : String(err)}`);
      return { error: 'Could not retrieve homework information right now.' };
    }
  }

  /** Staff-only in practice — self-scoped by requestedByUserId, so a parent asking this just
   * honestly gets "no leave requests found" rather than anything resembling a security leak. There is
   * no leave-entitlement/balance concept in this system (confirmed: LeaveType is free text, no
   * allotment table) — this returns request history/status, never a fabricated "days remaining". */
  async getLeaveRequests(user: JwtUserPayload) {
    try {
      const requests = await this.hrService.listLeaveRequests(user);
      const own = requests.filter((r) => r.requestedByUserId === user.sub);
      if (own.length === 0) {
        return { message: 'No leave requests found for you.' };
      }
      return {
        requests: own.slice(0, 10).map((r) => ({
          leaveType: r.leaveType,
          startDate: r.startDate,
          endDate: r.endDate,
          status: r.status,
        })),
      };
    } catch (err) {
      this.logger.error(`getLeaveRequests failed: ${err instanceof Error ? err.message : String(err)}`);
      return { error: 'Could not retrieve leave request information right now.' };
    }
  }
}
