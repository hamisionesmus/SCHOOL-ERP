import { Module } from '@nestjs/common';
import { CommunicationsModule } from '../communications/communications.module';
import { WorkflowRegistryService } from './workflow-registry.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowDefinitionsService } from './workflow-definitions.service';
import { WorkflowDefinitionsController } from './workflow-definitions.controller';

@Module({
  imports: [CommunicationsModule],
  controllers: [WorkflowDefinitionsController],
  providers: [WorkflowRegistryService, WorkflowEngineService, WorkflowDefinitionsService],
  exports: [WorkflowRegistryService, WorkflowEngineService, WorkflowDefinitionsService],
})
export class WorkflowsModule {}
