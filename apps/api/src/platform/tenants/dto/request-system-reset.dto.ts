import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RequestSystemResetDto {
  @ApiProperty({ required: false, description: 'Id of one school to keep for ongoing testing — every other school is deleted' })
  @IsOptional()
  @IsString()
  keepTenantId?: string;
}
