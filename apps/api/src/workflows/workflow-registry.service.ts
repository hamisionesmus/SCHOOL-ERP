import { Injectable } from '@nestjs/common';

export type WorkflowCompletionHandler = (
  entityId: string,
  finalStatus: 'APPROVED' | 'REJECTED',
  actorUserId: string,
  tenantSchema: string,
) => Promise<void>;

/**
 * Keeps WorkflowsModule fully generic — it has zero knowledge of LeaveRequest or any other entity.
 * A feature module (e.g. HrModule) registers a handler for its entityType (e.g. 'LEAVE_REQUEST') at
 * startup; WorkflowEngineService calls it once an instance reaches a terminal state. Any future
 * module (Tickets, Procurement, ...) plugs in the same way, with no change to the engine itself.
 */
@Injectable()
export class WorkflowRegistryService {
  private readonly handlers = new Map<string, WorkflowCompletionHandler>();

  registerHandler(entityType: string, handler: WorkflowCompletionHandler) {
    this.handlers.set(entityType, handler);
  }

  getHandler(entityType: string): WorkflowCompletionHandler | undefined {
    return this.handlers.get(entityType);
  }
}
