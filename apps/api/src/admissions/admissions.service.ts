import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { UserDirectoryService } from '../common/user-directory/user-directory.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { generateAdmissionNumber } from '../students/admission-number.util';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly userDirectory: UserDirectoryService,
  ) {}

  async create(user: JwtUserPayload, dto: CreateApplicationDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.application.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        gradeLevelId: dto.gradeLevelId,
        guardianName: dto.guardianName,
        guardianEmail: dto.guardianEmail,
        guardianPhone: dto.guardianPhone,
        notes: dto.notes,
      },
      include: { gradeLevel: true },
    });
  }

  async list(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.application.findMany({ include: { gradeLevel: true }, orderBy: { createdAt: 'desc' } });
  }

  async updateStatus(user: JwtUserPayload, id: string, dto: UpdateApplicationStatusDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const application = await db.application.findUnique({ where: { id } });
    if (!application) throw new NotFoundException('Application not found');
    if (application.status === 'ADMITTED') {
      throw new BadRequestException('Already admitted; cannot change status');
    }
    return db.application.update({ where: { id }, data: { status: dto.status } });
  }

  /** Admits an application: finds-or-creates the guardian's Parent user, creates the Student record
   * (reusing the same admission-number logic as direct student creation), links the guardian, and
   * marks the application ADMITTED. */
  async admit(user: JwtUserPayload, id: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const application = await db.application.findUnique({ where: { id } });
    if (!application) throw new NotFoundException('Application not found');
    if (application.status === 'ADMITTED') {
      throw new BadRequestException('This application has already been admitted');
    }

    await this.userDirectory.reserveForSchema(application.guardianEmail, user.tenantSchema!);
    const passwordHash = await bcrypt.hash(randomUUID(), 12);
    const guardianUser = await db.user.upsert({
      where: { email: application.guardianEmail },
      update: {},
      create: { email: application.guardianEmail, fullName: application.guardianName, passwordHash },
    });
    const parentRole = await db.role.findUnique({ where: { name: 'Parent' } });
    if (parentRole) {
      await db.userRole.upsert({
        where: { userId_roleId: { userId: guardianUser.id, roleId: parentRole.id } },
        update: {},
        create: { userId: guardianUser.id, roleId: parentRole.id },
      });
    }

    const admissionNumber = await generateAdmissionNumber(db);
    const student = await db.student.create({
      data: {
        admissionNumber,
        firstName: application.firstName,
        lastName: application.lastName,
        dateOfBirth: application.dateOfBirth,
        gender: application.gender,
        gradeLevelId: application.gradeLevelId,
        guardians: {
          create: { guardianUserId: guardianUser.id, relationship: 'GUARDIAN', isPrimaryContact: true },
        },
      },
      include: { gradeLevel: true, guardians: true },
    });

    await db.application.update({
      where: { id },
      data: { status: 'ADMITTED', admittedStudentId: student.id },
    });

    return student;
  }
}
