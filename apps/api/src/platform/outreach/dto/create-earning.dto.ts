import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsInt, IsOptional, IsString, Min } from 'class-validator';

const PERIODS = ['DAILY', 'WEEKLY'] as const;

export class CreateEarningDto {
  @ApiProperty({ enum: PERIODS })
  @IsIn(PERIODS)
  period!: (typeof PERIODS)[number];

  @ApiProperty({ description: 'The day, or the week-starting date, this earning covers' })
  @IsISO8601()
  periodDate!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  amount!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  challenges?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
