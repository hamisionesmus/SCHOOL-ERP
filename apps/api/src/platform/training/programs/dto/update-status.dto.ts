import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const STATUSES = ['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;

export class UpdateProgramStatusDto {
  @ApiProperty({ enum: STATUSES })
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];
}
