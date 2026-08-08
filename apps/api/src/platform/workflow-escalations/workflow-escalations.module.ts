import { Module } from '@nestjs/common';
import { CommunicationsModule } from '../../communications/communications.module';
import { WorkflowsModule } from '../../workflows/workflows.module';
import { WorkflowEscalationsService } from './workflow-escalations.service';

@Module({
  imports: [CommunicationsModule, WorkflowsModule],
  providers: [WorkflowEscalationsService],
})
export class WorkflowEscalationsModule {}
