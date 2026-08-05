import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ConfirmSystemResetDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  requestId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  code!: string;
}
