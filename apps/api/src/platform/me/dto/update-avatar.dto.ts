import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateAvatarDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  avatarUrl!: string;
}
