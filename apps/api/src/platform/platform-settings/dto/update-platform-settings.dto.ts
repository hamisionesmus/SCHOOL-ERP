import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paybillNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paybillAccountName?: string;
}
