import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { SubmitHomeworkDto } from './dto/submit-homework.dto';

@Injectable()
export class HomeworkService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(user: JwtUserPayload, dto: CreateAssignmentDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.assignment.create({
      data: {
        classId: dto.classId,
        title: dto.title,
        description: dto.description,
        dueDate: new Date(dto.dueDate),
        createdByUserId: user.sub,
      },
      include: { schoolClass: true },
    });
  }

  async list(user: JwtUserPayload, classId?: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];
    const where: Record<string, unknown> = {};
    if (classId) where.classId = classId;

    if (perms.includes('HOMEWORK:VIEW')) {
      return db.assignment.findMany({
        where,
        include: { schoolClass: true, submissions: true },
        orderBy: { dueDate: 'desc' },
      });
    }

    if (perms.includes('STUDENT:VIEW_OWN_CHILD')) {
      return db.assignment.findMany({
        where: { ...where, schoolClass: { students: { some: { guardians: { some: { guardianUserId: user.sub } } } } } },
        include: { schoolClass: true },
        orderBy: { dueDate: 'desc' },
      });
    }

    if (perms.includes('STUDENT:VIEW_OWN_RECORD')) {
      return db.assignment.findMany({
        where: { ...where, schoolClass: { students: { some: { userId: user.sub } } } },
        include: {
          schoolClass: true,
          submissions: { where: { student: { userId: user.sub } } },
        },
        orderBy: { dueDate: 'desc' },
      });
    }

    throw new ForbiddenException('No permission to view homework');
  }

  async submit(user: JwtUserPayload, assignmentId: string, dto: SubmitHomeworkDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const student = await db.student.findFirst({ where: { userId: user.sub } });
    if (!student) throw new ForbiddenException('Only a student can submit homework for themselves');

    const assignment = await db.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');

    return db.submission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
      update: { content: dto.content, submittedAt: new Date() },
      create: { assignmentId, studentId: student.id, content: dto.content, submittedAt: new Date() },
    });
  }

  async listSubmissions(user: JwtUserPayload, assignmentId: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];
    if (!perms.includes('HOMEWORK:VIEW')) {
      throw new ForbiddenException('No permission to view submissions');
    }
    return db.submission.findMany({
      where: { assignmentId },
      include: { student: true },
      orderBy: { submittedAt: 'desc' },
    });
  }
}
