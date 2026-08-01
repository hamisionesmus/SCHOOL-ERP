import { Module } from '@nestjs/common';
import { SickSheetsController } from './sick-sheets.controller';
import { SickSheetsService } from './sick-sheets.service';

@Module({
  controllers: [SickSheetsController],
  providers: [SickSheetsService],
})
export class SickSheetsModule {}
