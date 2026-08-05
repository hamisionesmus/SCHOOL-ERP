import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class SubmitAbsenceReasonDto {
  @ApiProperty({ description: 'The email you were invited with' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Why you were unable to attend' })
  @IsString()
  reason!: string;
}
