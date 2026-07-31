import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssignTransportDto {
  @ApiProperty()
  @IsString()
  studentId!: string;

  @ApiProperty()
  @IsString()
  routeId!: string;
}
