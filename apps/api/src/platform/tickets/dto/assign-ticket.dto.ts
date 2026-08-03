import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssignTicketDto {
  @ApiProperty()
  @IsString()
  assignedToId!: string;
}
