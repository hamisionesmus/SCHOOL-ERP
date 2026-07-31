import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * One endpoint, sections computed conditionally by permission — same "server decides what's
 * included" pattern used by StudentsService.list() rather than a separate endpoint per role.
 * A School Administrator holds nearly every permission, so they see every section; a Class
 * Teacher/Finance Officer/Parent/Student each see only what their role actually grants.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async getSummary(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];
    const result: Record<string, unknown> = {};

    const tasks: Promise<void>[] = [];

    if (perms.includes('TENANT:MANAGE_USERS')) {
      tasks.push(this.getSchoolStats(db).then((r) => { result.school = r; }));
    }
    if (perms.includes('FINANCE:EDIT') || perms.includes('FINANCE:RECEIVE_PAYMENT')) {
      tasks.push(this.getFinanceStats(db).then((r) => { result.finance = r; }));
    }
    if (perms.includes('ATTENDANCE:MARK')) {
      tasks.push(this.getClassTeacherStats(db, user.sub).then((r) => { result.myClass = r; }));
    }
    if (perms.includes('TRANSPORT:MANAGE') || perms.includes('TRANSPORT:PROPOSE')) {
      tasks.push(this.getTripStats(db, perms.includes('TRANSPORT:MANAGE')).then((r) => { result.trips = r; }));
    }
    if (perms.includes('STUDENT:VIEW_OWN_CHILD') || perms.includes('STUDENT:VIEW_OWN_RECORD')) {
      tasks.push(this.getOwnStats(db, user).then((r) => { result.own = r; }));
    }

    await Promise.all(tasks);
    return result;
  }

  private async getSchoolStats(db: ReturnType<TenantPrismaService['forSchema']>) {
    const [totalStudents, genderGroups, gradeGroups, gradeLevels, roles, pendingAdmissions] = await Promise.all([
      db.student.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      db.student.groupBy({ by: ['gender'], where: { status: 'ACTIVE', deletedAt: null }, _count: true }),
      db.student.groupBy({ by: ['gradeLevelId'], where: { status: 'ACTIVE', deletedAt: null }, _count: true }),
      db.gradeLevel.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.role.findMany({
        where: { name: { notIn: ['Parent', 'Student'] } },
        include: { _count: { select: { userRoles: true } } },
      }),
      db.application.count({ where: { status: { in: ['APPLIED', 'INTERVIEW', 'OFFERED', 'WAITLISTED'] } } }),
    ]);

    const gradeNameById = new Map(gradeLevels.map((g) => [g.id, g.name]));
    const boys = genderGroups.find((g) => g.gender === 'MALE')?._count ?? 0;
    const girls = genderGroups.find((g) => g.gender === 'FEMALE')?._count ?? 0;

    return {
      totalStudents,
      boys,
      girls,
      gradeBreakdown: gradeGroups
        .map((g) => ({ grade: gradeNameById.get(g.gradeLevelId) ?? 'Unknown', count: g._count }))
        .sort((a, b) => b.count - a.count),
      totalStaff: roles.reduce((sum, r) => sum + r._count.userRoles, 0),
      roleBreakdown: roles.map((r) => ({ role: r.name, count: r._count.userRoles })).filter((r) => r.count > 0),
      pendingAdmissions,
    };
  }

  private async getFinanceStats(db: ReturnType<TenantPrismaService['forSchema']>) {
    const [revenueAgg, outstandingAgg, statusGroups] = await Promise.all([
      db.payment.aggregate({ _sum: { amount: true } }),
      db.invoice.aggregate({ _sum: { balance: true }, where: { status: { notIn: ['PAID', 'CANCELLED'] } } }),
      db.invoice.groupBy({ by: ['status'], _count: true }),
    ]);

    const totalRevenue = revenueAgg._sum.amount ?? 0;
    const totalOutstanding = outstandingAgg._sum.balance ?? 0;
    const denominator = totalRevenue + totalOutstanding;

    return {
      totalRevenue,
      totalOutstanding,
      collectionRatePct: denominator > 0 ? Math.round((totalRevenue / denominator) * 100) : 100,
      invoiceStatusBreakdown: statusGroups.map((s) => ({ status: s.status, count: s._count })),
    };
  }

  private async getClassTeacherStats(db: ReturnType<TenantPrismaService['forSchema']>, teacherId: string) {
    const myClasses = await db.schoolClass.findMany({
      where: { classTeacherId: teacherId },
      include: { _count: { select: { students: true } } },
    });
    const classIds = myClasses.map((c) => c.id);
    const totalStudents = myClasses.reduce((sum, c) => sum + c._count.students, 0);

    if (classIds.length === 0) {
      return { classes: [], totalStudents: 0, todayAttendanceRatePct: null, weeklyTrend: [] };
    }

    const today = startOfDay(new Date());
    const [todayRecords, weeklyTrend] = await Promise.all([
      db.attendanceRecord.findMany({ where: { classId: { in: classIds }, date: today }, select: { status: true } }),
      this.weeklyAttendanceTrend(db, classIds),
    ]);

    const todayPresent = todayRecords.filter((r) => r.status === 'PRESENT').length;

    return {
      classes: myClasses.map((c) => ({ id: c.id, name: c.name, studentCount: c._count.students })),
      totalStudents,
      todayAttendanceRatePct: todayRecords.length > 0 ? Math.round((todayPresent / todayRecords.length) * 100) : null,
      weeklyTrend,
    };
  }

  private async weeklyAttendanceTrend(db: ReturnType<TenantPrismaService['forSchema']>, classIds: string[]) {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = startOfDay(new Date());
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const records = await db.attendanceRecord.findMany({
      where: { classId: { in: classIds }, date: { gte: days[0] } },
      select: { date: true, status: true },
    });

    return days.map((d) => {
      const dayRecords = records.filter((r) => r.date.getTime() === d.getTime());
      const present = dayRecords.filter((r) => r.status === 'PRESENT').length;
      return {
        date: d.toISOString().slice(0, 10),
        ratePct: dayRecords.length > 0 ? Math.round((present / dayRecords.length) * 100) : null,
      };
    });
  }

  private async getTripStats(db: ReturnType<TenantPrismaService['forSchema']>, canManage: boolean) {
    const today = startOfDay(new Date());
    const [upcomingApprovedCount, pendingApprovalCount, revenueAgg, nextTrip] = await Promise.all([
      db.trip.count({ where: { status: 'APPROVED', tripDate: { gte: today } } }),
      canManage ? db.trip.count({ where: { status: 'PROPOSED' } }) : Promise.resolve(0),
      db.tripPayment.aggregate({ _sum: { amount: true } }),
      db.trip.findFirst({
        where: { status: 'APPROVED', tripDate: { gte: today } },
        orderBy: { tripDate: 'asc' },
        select: { id: true, title: true, tripDate: true, destination: true },
      }),
    ]);

    return {
      upcomingApprovedCount,
      pendingApprovalCount,
      totalTripRevenue: revenueAgg._sum.amount ?? 0,
      nextTrip,
    };
  }

  private async getOwnStats(db: ReturnType<TenantPrismaService['forSchema']>, user: JwtUserPayload) {
    const perms = user.permissions ?? [];
    const where = perms.includes('STUDENT:VIEW_OWN_CHILD')
      ? { deletedAt: null, guardians: { some: { guardianUserId: user.sub } } }
      : { deletedAt: null, userId: user.sub };

    const students = await db.student.findMany({
      where,
      include: { gradeLevel: true },
    });

    const today = startOfDay(new Date());
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const children = await Promise.all(
      students.map(async (s) => {
        const [attendanceRecords, invoiceAgg] = await Promise.all([
          db.attendanceRecord.findMany({
            where: { studentId: s.id, date: { gte: thirtyDaysAgo } },
            select: { status: true },
          }),
          db.invoice.aggregate({ _sum: { balance: true }, where: { studentId: s.id, status: { notIn: ['CANCELLED'] } } }),
        ]);
        const present = attendanceRecords.filter((r) => r.status === 'PRESENT').length;

        return {
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          photoUrl: s.photoUrl,
          gradeLevelName: s.gradeLevel.name,
          attendanceRate30dPct:
            attendanceRecords.length > 0 ? Math.round((present / attendanceRecords.length) * 100) : null,
          feeBalance: invoiceAgg._sum.balance ?? 0,
        };
      }),
    );

    const nextTrip = await db.trip.findFirst({
      where: { status: 'APPROVED', tripDate: { gte: today } },
      orderBy: { tripDate: 'asc' },
      select: { id: true, title: true, tripDate: true, destination: true },
    });

    return { children, nextTrip };
  }
}
