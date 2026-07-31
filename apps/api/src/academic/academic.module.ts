import { Module } from '@nestjs/common';
import { AcademicController } from './academic.controller';

@Module({
  controllers: [AcademicController],
})
export class AcademicModule {}
