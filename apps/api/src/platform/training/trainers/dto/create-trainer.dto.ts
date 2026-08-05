import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';

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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  centerId?: string;

  @ApiProperty({ enum: TRACKS, required: false })
  @IsOptional()
  @IsIn(TRACKS)
  track?: (typeof TRACKS)[number];

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
