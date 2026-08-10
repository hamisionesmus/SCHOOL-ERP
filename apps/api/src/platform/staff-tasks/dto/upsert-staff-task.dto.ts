import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

export class UpsertStaffTaskDto {
  @ApiProperty()
  @IsString()
  assignedToUserId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, description: 'Which repo to work in — for software engineer / dev tasks' })
  @IsOptional()
  @IsUrl()
  repoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @ApiProperty({ enum: STATUSES, required: false })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiProperty({ required: false, description: 'Link this task to a CRM client — a follow-up, a promised call-back, etc.' })
  @IsOptional()
  @IsString()
  hamzoneClientId?: string;

  @ApiProperty({ required: false, description: 'Link this task to a not-yet-converted CRM lead' })
  @IsOptional()
  @IsString()
  hamzoneLeadId?: string;
}
