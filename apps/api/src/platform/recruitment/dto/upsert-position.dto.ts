import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Min, MinLength, ValidateIf } from 'class-validator';

const ROLE_TYPES = ['TRAINER', 'GIG_WORKER', 'SOFTWARE_ENGINEER', 'STAFF'] as const;

export class UpsertPositionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ enum: ROLE_TYPES, description: 'What kind of system access a successful applicant gets' })
  @IsIn(ROLE_TYPES)
  roleType!: (typeof ROLE_TYPES)[number];

  @ApiProperty({ required: false, description: 'Required when roleType is STAFF' })
  @ValidateIf((o) => o.roleType === 'STAFF')
  @IsString()
  @MinLength(1, { message: 'roleTypeOther is required when roleType is STAFF' })
  roleTypeOther?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ example: 2, description: 'How many people the company actually intends to hire for this role' })
  @IsInt()
  @Min(1)
  requiredPositions!: number;

  @ApiProperty({ example: 50, description: 'Cap on total applications — once reached, the public apply link shows "at capacity"' })
  @IsInt()
  @Min(1)
  maxApplicants!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  closesAt?: string;
}
