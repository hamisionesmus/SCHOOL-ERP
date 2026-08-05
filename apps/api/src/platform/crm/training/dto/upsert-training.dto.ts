import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsISO8601, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

const TRACKS = ['FRONTEND', 'BACKEND', 'CODING_ROBOTICS', 'OTHER'] as const;
const STATUSES = ['ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

// Shared by both create (traineeName/track are required there — enforced in the service, so an
// update can send just `{ status }` without re-submitting the whole record) and update.
export class UpsertTrainingDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  traineeName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  traineeEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  traineePhone?: string;

  @ApiProperty({ enum: TRACKS, required: false })
  @IsOptional()
  @IsIn(TRACKS)
  track?: (typeof TRACKS)[number];

  @ApiProperty({ required: false, description: 'Required when track is OTHER' })
  @ValidateIf((o) => o.track === 'OTHER')
  @IsString()
  @MinLength(1, { message: 'trackOther is required when track is OTHER' })
  trackOther?: string;

  @ApiProperty({ enum: STATUSES, required: false })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  startedAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  completedAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
