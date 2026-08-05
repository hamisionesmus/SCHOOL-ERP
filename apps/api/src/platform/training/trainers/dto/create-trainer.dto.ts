import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsISO8601, IsOptional, IsString, Min, MinLength, ValidateIf } from 'class-validator';

const TRACKS = ['FRONTEND', 'BACKEND', 'CODING_ROBOTICS', 'OTHER'] as const;

export class CreateTrainerDto {
  @ApiProperty()
  @IsString()
  fullName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty({ required: false, description: 'Physical address — helps the company know roughly where this trainer is based' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  centerId?: string;

  @ApiProperty({ enum: TRACKS, required: false })
  @IsOptional()
  @IsIn(TRACKS)
  track?: (typeof TRACKS)[number];

  @ApiProperty({ required: false, description: 'Required when track is OTHER' })
  @ValidateIf((o) => o.track === 'OTHER')
  @IsString()
  @MinLength(1, { message: 'trackOther is required when track is OTHER' })
  trackOther?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlySalaryKes?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  contractStartDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  contractEndDate?: string;
}
