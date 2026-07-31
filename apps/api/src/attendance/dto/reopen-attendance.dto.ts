import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString } from 'class-validator';

export class ReopenAttendanceDto {
  @ApiProperty()
  @IsString()
  classId!: string;

  @ApiProperty({ example: '2026-07-31' })
  @IsDateString()
  date!: string;
}
