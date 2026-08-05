import { Module } from '@nestjs/common';
import { StaffTasksService } from './staff-tasks.service';
import { StaffTasksController } from './staff-tasks.controller';

@Module({
  controllers: [StaffTasksController],
  providers: [StaffTasksService],
})
export class StaffTasksModule {}
