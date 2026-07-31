import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SubmitHomeworkDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;
}
