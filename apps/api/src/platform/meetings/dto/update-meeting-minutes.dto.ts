import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateMeetingMinutesDto {
  @ApiProperty({ description: 'Plain-text minutes; an empty string clears them' })
  @IsString()
  minutes!: string;
}
