import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ResolveEscalationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
