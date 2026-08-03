import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ResolveTicketDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
