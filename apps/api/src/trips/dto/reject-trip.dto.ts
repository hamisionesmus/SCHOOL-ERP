import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectTripDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
