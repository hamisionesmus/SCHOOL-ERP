import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString, MaxLength } from 'class-validator';

export class SendAnnouncementDto {
  @ApiProperty({ type: [String], description: 'User IDs to notify (e.g. guardians of a class)' })
  @IsArray()
  @ArrayNotEmpty()
  recipientUserIds!: string[];

  @ApiProperty({ example: 'PTA meeting this Friday at 3pm.' })
  @IsString()
  @MaxLength(480)
  body!: string;
}
