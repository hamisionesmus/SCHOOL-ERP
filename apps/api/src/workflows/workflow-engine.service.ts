import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '../../generated/tenant-client';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CommunicationsService } from '../communications/communications.service';
import { WorkflowRegistryService } from './workflow-registry.service';

interface StartInstanceInput {
  db: PrismaClient;
  entityType: string;
  entityId: string;
  user: JwtUserPayload;
}

/**
 * Generic step-chain engine. Knows nothing about LeaveRequest or any other feature — a step's
 * approver is resolved purely from the permission code stored on WorkflowStepDefinition, and what
 * happens on completion is delegated to whatever handler the owning module registered (see
 * WorkflowRegistryService). See docs plan "Generic Workflow/Approval Engine — Phase 1" for the design.
 */
@Injectable()
export class WorkflowEngineService {
  constructor(
    private readonly registry: WorkflowRegistryService,
    private readonly communications: CommunicationsService,
  ) {}

  /** Anyone holding a role that grants `code` — this schema has no reporting-hierarchy/org-chart
   * concept, so "who approves this step" is answered purely via the existing RBAC relations. */
  async resolvePermissionHolders(db: PrismaClient, code: string) {
    return db.user.findMany({
      where: { userRoles: { some: { role: { rolePermissions: { some: { permission: { code } } } } } } },
      select: { id: true },
    });
  }

  private async notifyStepHolders(db: PrismaClient, tenantSchema: string, permissionCode: string, message: string, emailSubject: string) {
    const holders = await this.resolvePermissionHolders(db, permissionCode);
    await Promise.all(
      holders.flatMap((h) => [
        this.communications.sendToUserId(tenantSchema, h.id, message),
        this.communications.sendEmailToUserId(tenantSchema, h.id, emailSubject, message),
      ]),
    );
  }

  /** Returns `null` when no active WorkflowDefinition exists for entityType — callers treat that as
   * "do it the old way" (see HrService.createLeaveRequest()), which is what keeps this opt-in. */
  async startInstance({ db, entityType, entityId, user }: StartInstanceInput) {
    const definition = await db.workflowDefinition.findFirst({
      where: { entityType, isActive: true },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!definition || definition.steps.length === 0) return null;

    const firstStep = definition.steps[0];
    const currentStepDueAt = firstStep.slaHours ? new Date(Date.now() + firstStep.slaHours * 3_600_000) : null;

    const instance = await db.workflowInstance.create({
      data: {
        entityType,
        entityId,
        workflowId: definition.id,
        currentStepOrder: firstStep.order,
        startedByUserId: user.sub,
        currentStepDueAt,
      },
    });

    await this.notifyStepHolders(
      db,
      user.tenantSchema!,
      firstStep.approverPermissionCode,
      `A new "${entityType.replace(/_/g, ' ').toLowerCase()}" request needs your review: "${firstStep.name}".`,
      `Approval needed — ${firstStep.name}`,
    );

    return instance;
  }

  /** Reactivates an existing terminal instance for the same entity — used when an entity that already
   * went through a full review cycle needs to go through it again (e.g. exam mark-sheets, which can be
   * reopened and resubmitted, unlike the one-shot entities — leave requests, admissions, trips — this
   * engine was first built for). Keeps the existing WorkflowStepAction history intact rather than
   * deleting and recreating the instance, since `@@unique([entityType, entityId])` means there can only
   * ever be one instance row per entity. Returns `null` under the same "no active definition" condition
   * as `startInstance`. */
  async restartInstance(db: PrismaClient, instanceId: string, user: JwtUserPayload) {
    const instance = await db.workflowInstance.findUnique({ where: { id: instanceId } });
    if (!instance) throw new NotFoundException('Workflow instance not found');

    const definition = await db.workflowDefinition.findFirst({
      where: { entityType: instance.entityType, isActive: true },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!definition || definition.steps.length === 0) return null;

    const firstStep = definition.steps[0];
    const currentStepDueAt = firstStep.slaHours ? new Date(Date.now() + firstStep.slaHours * 3_600_000) : null;

    const updated = await db.workflowInstance.update({
      where: { id: instanceId },
      data: {
        workflowId: definition.id,
        status: 'IN_PROGRESS',
        currentStepOrder: firstStep.order,
        currentStepDueAt,
        lastEscalatedAt: null,
      },
    });

    await this.notifyStepHolders(
      db,
      user.tenantSchema!,
      firstStep.approverPermissionCode,
      `A "${instance.entityType.replace(/_/g, ' ').toLowerCase()}" request needs your review: "${firstStep.name}".`,
      `Approval needed — ${firstStep.name}`,
    );

    return updated;
  }

  /** Verifies the actor holds the *current* step's permission (a strictly more precise check than a
   * blanket controller-level guard could express), records the action, and either advances to the
   * next step or closes the instance and calls the registered completion handler. */
  async recordAction(db: PrismaClient, instanceId: string, user: JwtUserPayload, action: 'APPROVE' | 'REJECT', comment?: string) {
    const instance = await db.workflowInstance.findUnique({
      where: { id: instanceId },
      include: { workflow: { include: { steps: { orderBy: { order: 'asc' } } } } },
    });
    if (!instance) throw new NotFoundException('Workflow instance not found');
    if (instance.status !== 'IN_PROGRESS') throw new ForbiddenException('This request has already been decided');

    const currentStep = instance.workflow.steps.find((s) => s.order === instance.currentStepOrder);
    if (!currentStep) throw new NotFoundException('Current workflow step not found');
    if (!(user.permissions ?? []).includes(currentStep.approverPermissionCode)) {
      throw new ForbiddenException(`Only a holder of ${currentStep.approverPermissionCode} can act on this step`);
    }

    await db.workflowStepAction.create({
      data: { instanceId, stepOrder: currentStep.order, actorUserId: user.sub, action, comment },
    });

    const isLastStep = currentStep.order === instance.workflow.steps[instance.workflow.steps.length - 1].order;

    if (action === 'REJECT' || (action === 'APPROVE' && isLastStep)) {
      const finalStatus = action === 'REJECT' ? 'REJECTED' : 'APPROVED';
      const updated = await db.workflowInstance.update({
        where: { id: instanceId },
        data: { status: finalStatus, currentStepDueAt: null },
      });
      const handler = this.registry.getHandler(instance.entityType);
      if (handler) await handler(instance.entityId, finalStatus, user.sub, user.tenantSchema!);
      return updated;
    }

    const nextStep = instance.workflow.steps.find((s) => s.order > currentStep.order);
    if (!nextStep) throw new NotFoundException('Next workflow step not found'); // unreachable given isLastStep check above

    const nextDueAt = nextStep.slaHours ? new Date(Date.now() + nextStep.slaHours * 3_600_000) : null;
    const updated = await db.workflowInstance.update({
      where: { id: instanceId },
      data: { currentStepOrder: nextStep.order, currentStepDueAt: nextDueAt, lastEscalatedAt: null },
    });

    await this.notifyStepHolders(
      db,
      user.tenantSchema!,
      nextStep.approverPermissionCode,
      `A "${instance.entityType.replace(/_/g, ' ').toLowerCase()}" request needs your review: "${nextStep.name}".`,
      `Approval needed — ${nextStep.name}`,
    );

    return updated;
  }
}
