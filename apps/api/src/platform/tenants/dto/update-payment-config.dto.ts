import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdatePaymentConfigDto {
  @ApiPropertyOptional({ example: '400200' })
  @IsOptional()
  @IsString()
  mpesaPaybill?: string;

  @ApiPropertyOptional({ example: 'Equity Bank' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: 'Greenfield Academy' })
  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @ApiPropertyOptional({ example: '0123456789' })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;
}
