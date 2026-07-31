import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectExamSubjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}
