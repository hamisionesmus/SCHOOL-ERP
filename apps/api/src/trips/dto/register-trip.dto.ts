import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RegisterTripDto {
  @ApiProperty()
  @IsString()
  studentId!: string;
}
