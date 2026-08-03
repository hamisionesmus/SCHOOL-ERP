import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class EscalateTicketDto {
  @ApiProperty({ description: 'Why the School Administrator cannot resolve this themselves' })
  @IsString()
  @MinLength(5)
  escalationReason!: string;
}
