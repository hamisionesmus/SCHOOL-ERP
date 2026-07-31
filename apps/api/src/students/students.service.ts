import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { AddGuardianDto } from './dto/add-guardian.dto';
import { generateAdmissionNumber } from './admission-number.util';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

@Injectable()
export class StudentsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

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
      },
      include: { gradeLevel: true, currentClass: true },
    });
  }

  async update(user: JwtUserPayload, studentId: string, dto: UpdateStudentDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const student = await db.student.findFirst({ where: { id: studentId, deletedAt: null } });
    if (!student) throw new NotFoundException('Student not found');

    return db.student.update({
      where: { id: studentId },
      data: dto,
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
}
