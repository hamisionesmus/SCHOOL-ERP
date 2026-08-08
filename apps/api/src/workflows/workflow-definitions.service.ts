import { Injectable, Logger } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { UpsertWorkflowDefinitionDto } from './dto/upsert-workflow-definition.dto';

@Injectable()
export class WorkflowDefinitionsService {
  private readonly logger = new Logger('WorkflowDefinitions');

  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  // TEMPORARY diagnostic logging — tracking down a real-user-reported "stuck loading" that every
  // other check (direct DB query, deployed-bundle inspection, fresh login) has failed to reproduce.
  // Remove once the root cause is found.
  async getActive(user: JwtUserPayload, entityType: string) {
    const t0 = Date.now();
    this.logger.log(`getActive() called: entityType=${entityType} tenantSchema=${user.tenantSchema} sub=${user.sub}`);
    try {
      const db = this.tenantPrisma.forSchema(user.tenantSchema!);
      const result = await db.workflowDefinition.findFirst({
        where: { entityType, isActive: true },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
      this.logger.log(`getActive() resolved in ${Date.now() - t0}ms: ${result ? 'found' : 'null'}`);
      return result;
    } catch (err) {
      this.logger.error(`getActive() threw after ${Date.now() - t0}ms: ${err instanceof Error ? err.stack : String(err)}`);
      throw err;
    }
  }

  /** Full-list-replace, same convention as this codebase's other "one editable config list" admin
   * screens (e.g. Pricing Tiers) — deactivates any existing active definition for entityType and
   * creates a fresh one with the submitted steps, inside a transaction. In-flight WorkflowInstances
   * keep referencing the deactivated definition's own steps (never mutated in place), so a config
   * change never corrupts an approval chain that's already partway through. */
  async upsert(user: JwtUserPayload, entityType: string, dto: UpsertWorkflowDefinitionDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.$transaction(async (tx) => {
      await tx.workflowDefinition.updateMany({ where: { entityType, isActive: true }, data: { isActive: false } });
      return tx.workflowDefinition.create({
        data: {
          entityType,
          steps: {
            create: dto.steps.map((s, i) => ({
              order: i,
              name: s.name,
              approverPermissionCode: s.approverPermissionCode,
              slaHours: s.slaHours,
            })),
          },
        },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
    });
  }
}
