import { Module } from '@nestjs/common';
import { HrController } from './hr.controller';
import { HrPayslipsController } from './hr-payslips.controller';
import { HrWorkLogsController } from './hr-work-logs.controller';
import { HrService } from './hr.service';

@Module({
  controllers: [HrController, HrPayslipsController, HrWorkLogsController],
  providers: [HrService],
})
export class HrModule {}
