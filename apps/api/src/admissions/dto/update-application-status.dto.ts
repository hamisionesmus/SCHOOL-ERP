import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const STATUSES = ['APPLIED', 'INTERVIEW', 'OFFERED', 'REJECTED', 'WAITLISTED'] as const;

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: STATUSES, description: 'Use POST /admissions/applications/:id/admit to admit' })
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];
}
