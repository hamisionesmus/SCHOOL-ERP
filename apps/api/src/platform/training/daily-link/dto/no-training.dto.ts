import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class NoTrainingDto {
  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'A reason is required when there is no training today' })
  reason!: string;
}
