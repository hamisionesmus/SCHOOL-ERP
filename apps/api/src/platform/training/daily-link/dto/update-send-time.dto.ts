import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min } from 'class-validator';

export class UpdateSendTimeDto {
  @ApiProperty()
  @IsString()
  programId!: string;

  @ApiProperty({ description: '0-23, East Africa Time' })
  @IsInt()
  @Min(0)
  @Max(23)
  sendHour!: number;
}
