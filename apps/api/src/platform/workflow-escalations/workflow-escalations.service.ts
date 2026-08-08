import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { CommunicationsService } from '../../communications/communications.service';
import { WorkflowEngineService } from '../../workflows/workflow-engine.service';

/**
 * Fans out across every tenant schema — same reason SystemHealthService's storage/login scans live
 * platform-side despite reading tenant data (see that service). A reminder only, sent to whoever
 * currently holds the overdue step's permission — not an escalation to someone else, since this
 * schema has no reporting-hierarchy concept to escalate *up* to (see docs plan). Dedup via
 * lastEscalatedAt, same *ReminderSentAt precedent as RemindersService.checkDeadlines().
 */
@Injectable()
export class WorkflowEscalationsService {
  private readonly logger = new Logger('WorkflowEscalations');

  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly communications: CommunicationsService,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkOverdueSteps() {
    const tenants = await this.platformPrisma.tenant.findMany({ where: { deletedAt: null }, select: { schemaName: true, slug: true } });
    const now = new Date();
    let sent = 0;

    for (const tenant of tenants) {
      const db = this.tenantPrisma.forSchema(tenant.schemaName);
      const overdue = await db.workflowInstance.findMany({
        where: { status: 'IN_PROGRESS', currentStepDueAt: { lt: now } },
        include: { workflow: { include: { steps: { orderBy: { order: 'asc' } } } } },
      });

      for (const instance of overdue) {
        // A step's due date only ever moves forward (recomputed on each advance) — comparing it
        // against the stored lastEscalatedAt in JS (rather than a raw SQL column comparison Prisma
        // can't express directly) is what makes this safe to re-run hourly without double-sending.
        if (instance.lastEscalatedAt && instance.lastEscalatedAt >= instance.currentStepDueAt!) continue;

        const currentStep = instance.workflow.steps.find((s) => s.order === instance.currentStepOrder);
        if (!currentStep) continue;

        const holders = await this.workflowEngine.resolvePermissionHolders(db, currentStep.approverPermissionCode);
        const message = `Reminder: "${currentStep.name}" (${instance.entityType.replace(/_/g, ' ').toLowerCase()}) is still awaiting your action.`;
        await Promise.all(
          holders.flatMap((h) => [
            this.communications.sendToUserId(tenant.schemaName, h.id, message),
            this.communications.sendEmailToUserId(tenant.schemaName, h.id, `Reminder — ${currentStep.name}`, message),
          ]),
        );
        await db.workflowInstance.update({ where: { id: instance.id }, data: { lastEscalatedAt: now } });
        sent++;
      }
    }

    if (sent > 0) this.logger.log(`Sent ${sent} workflow escalation reminder(s).`);
    return { sent };
  }
}
