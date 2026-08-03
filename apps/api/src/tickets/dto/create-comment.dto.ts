import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateTicketCommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  body!: string;
}
