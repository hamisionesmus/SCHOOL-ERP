import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { CommunicationsModule } from '../communications/communications.module';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [CommunicationsModule, WorkflowsModule],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}
