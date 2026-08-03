import { Module } from '@nestjs/common';
import { PlatformFinanceController } from './finance.controller';
import { PlatformFinanceService } from './finance.service';

@Module({
  controllers: [PlatformFinanceController],
  providers: [PlatformFinanceService],
})
export class PlatformFinanceModule {}
