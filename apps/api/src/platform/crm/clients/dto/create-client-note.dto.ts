import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateClientNoteDto {
  @ApiProperty({ description: 'Summary of a call, meeting, promise, or agreement made with this client' })
  @IsString()
  @MinLength(1)
  body!: string;
}
