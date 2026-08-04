import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn } from 'class-validator';
import { PLATFORM_MODULES } from '../platform-modules';

export class SetModuleGrantsDto {
  @ApiProperty({ enum: PLATFORM_MODULES, isArray: true })
  @IsArray()
  @IsIn(PLATFORM_MODULES, { each: true })
  modules!: string[];
}
