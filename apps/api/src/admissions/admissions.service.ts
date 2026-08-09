import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { UserDirectoryService } from '../common/user-directory/user-directory.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { generateAdmissionNumber } from '../students/admission-number.util';
import { WorkflowEngineService } from '../workflows/workflow-engine.service';
import { WorkflowRegistryService } from '../workflows/workflow-registry.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

const ADMISSION_APPLICATION_ENTITY_TYPE = 'ADMISSION_APPLICATION';
// Statuses that mean "already decided" — used both to block the free-form status dropdown once a
// decision has landed and to guard the fallback (no-workflow-configured) approve/reject path against
// double-review, mirroring HrService.setStatus()'s `request.status !== 'PENDING'` check.
const DECIDED_STATUSES = ['OFFERED', 'ADMITTED', 'REJECTED'] as const;

@Injectable()
export class AdmissionsService implements OnModuleInit {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly userDirectory: UserDirectoryService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly workflowRegistry: WorkflowRegistryService,
  ) {}

  /** Plugs Application into the generic workflow engine — the only place AdmissionsService and the
   * engine touch each other. ApplicationStatus isn't binary like LeaveStatus, so the workflow's
   * finalStatus ('APPROVED'|'REJECTED') is mapped onto this module's own domain status: APPROVED
   * becomes OFFERED (a School Administrator still has to explicitly admit() to actually create the
   * Student — that terminal, data-creating step stays a distinct manual action either way), REJECTED
   * stays REJECTED. */
  onModuleInit() {
    this.workflowRegistry.registerHandler(ADMISSION_APPLICATION_ENTITY_TYPE, async (entityId, finalStatus, actorUserId, tenantSchema) => {
      const db = this.tenantPrisma.forSchema(tenantSchema);
      await db.application.update({
        where: { id: entityId },
        data: { status: finalStatus === 'APPROVED' ? 'OFFERED' : 'REJECTED', reviewedByUserId: actorUserId },
      });
    });
  }

  async create(user: JwtUserPayload, dto: CreateApplicationDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const application = await db.application.create({
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
    // Returns null when no active WorkflowDefinition exists for 'ADMISSION_APPLICATION' — this school
    // hasn't configured an approval chain, so the application just stays APPLIED for direct
    // ADMISSION:MANAGE triage via the existing status dropdown/admit action, exactly as before this
    // engine existed.
    await this.workflowEngine.startInstance({ db, entityType: ADMISSION_APPLICATION_ENTITY_TYPE, entityId: application.id, user });
    return application;
  }

  async list(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const applications = await db.application.findMany({ include: { gradeLevel: true }, orderBy: { createdAt: 'desc' } });
    if (applications.length === 0) return applications;

    // WorkflowInstance isn't a Prisma relation of Application (the engine is entity-agnostic — see
    // WorkflowEngineService) so it's fetched separately and attached in application code.
    const instances = await db.workflowInstance.findMany({
      where: { entityType: ADMISSION_APPLICATION_ENTITY_TYPE, entityId: { in: applications.map((a) => a.id) } },
      include: {
        workflow: { include: { steps: { orderBy: { order: 'asc' } } } },
        actions: { orderBy: { actedAt: 'asc' }, include: { actor: { select: { id: true, fullName: true } } } },
      },
    });
    const instanceByEntityId = new Map(instances.map((i) => [i.entityId, i]));
    return applications.map((a) => ({ ...a, workflowInstance: instanceByEntityId.get(a.id) ?? null }));
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

  private async setDecision(user: JwtUserPayload, id: string, action: 'APPROVE' | 'REJECT', comment?: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const application = await db.application.findUnique({ where: { id } });
    if (!application) throw new NotFoundException('Application not found');

    const instance = await db.workflowInstance.findUnique({
      where: { entityType_entityId: { entityType: ADMISSION_APPLICATION_ENTITY_TYPE, entityId: id } },
    });
    if (instance) {
      // WorkflowEngineService.recordAction() does its own precise permission check (holder of the
      // *current step's* permission code) and, on a terminal decision, calls the handler registered
      // in onModuleInit() above — which is what actually updates this Application row.
      await this.workflowEngine.recordAction(db, instance.id, user, action, comment);
      return db.application.findUnique({ where: { id } });
    }

    // Fallback path — no workflow configured for this tenant. The controller no longer gates these
    // routes with @RequirePermission, so the check moves here (same "authorization moved into the
    // service" pattern already used by HrService.setStatus()).
    if (!(user.permissions ?? []).includes('ADMISSION:MANAGE')) {
      throw new ForbiddenException('No permission to review applications');
    }
    if ((DECIDED_STATUSES as readonly string[]).includes(application.status)) {
      throw new BadRequestException('This application was already reviewed');
    }
    return db.application.update({
      where: { id },
      data: { status: action === 'APPROVE' ? 'OFFERED' : 'REJECTED', reviewedByUserId: user.sub },
    });
  }

  approve(user: JwtUserPayload, id: string, comment?: string) {
    return this.setDecision(user, id, 'APPROVE', comment);
  }

  reject(user: JwtUserPayload, id: string, comment?: string) {
    return this.setDecision(user, id, 'REJECT', comment);
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
