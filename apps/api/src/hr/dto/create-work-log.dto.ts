import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateWorkLogDto {
  @ApiProperty({ example: '2026-07-31' })
  @IsDateString()
  date!: string;

  @ApiProperty()
  @IsString()
  tasksDone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tasksPending?: string;
}
