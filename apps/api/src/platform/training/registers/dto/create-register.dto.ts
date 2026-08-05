import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';

export class CreateRegisterDto {
  @ApiProperty()
  @IsString()
  programId!: string;

  @ApiProperty()
  @IsISO8601()
  date!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  traineesPresent!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  traineesTotal!: number;

  @ApiProperty()
  @IsString()
  topicsCovered!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
