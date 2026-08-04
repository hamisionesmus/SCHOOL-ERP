import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SendEmailDto {
  @ApiProperty()
  @IsEmail()
  to!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  subject!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  body!: string;
}

export class ReplyEmailDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  body!: string;
}
