import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReviewPaymentProofDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewNote?: string;
}
