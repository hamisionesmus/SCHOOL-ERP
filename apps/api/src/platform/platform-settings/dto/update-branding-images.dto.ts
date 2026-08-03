import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateBrandingImagesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  loginLogoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  faviconUrl?: string;
}
