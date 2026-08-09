import { Module } from '@nestjs/common';
import { HrController } from './hr.controller';
import { HrPayslipsController } from './hr-payslips.controller';
import { HrWorkLogsController } from './hr-work-logs.controller';
import { HrService } from './hr.service';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [WorkflowsModule],
  controllers: [HrController, HrPayslipsController, HrWorkLogsController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
