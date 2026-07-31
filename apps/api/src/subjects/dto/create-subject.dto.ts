import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'MATH' })
  @IsString()
  code!: string;
}
