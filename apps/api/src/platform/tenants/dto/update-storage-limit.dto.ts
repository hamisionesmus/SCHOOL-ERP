import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateStorageLimitDto {
  @ApiPropertyOptional({ description: 'Storage cap in MB — omit/null for no limit' })
  @IsOptional()
  @IsInt()
  @Min(0)
  storageLimitMb?: number | null;
}
