import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsISO8601, IsOptional, IsString } from 'class-validator';

export class CreateMeetingDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, description: 'Zoom / Google Meet link' })
  @IsOptional()
  @IsString()
  meetingLink?: string;

  @ApiProperty()
  @IsISO8601()
  scheduledAt!: string;

  @ApiProperty({ required: false, type: [String], description: "Subset of SUPER_ADMIN/SUB_ADMIN/ASSISTANT_SUPER_ADMIN/TRAINER" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  audienceRoles?: string[];

  @ApiProperty({ required: false, type: [String], description: 'Matches PlatformUser.teamTags — e.g. FRONTEND, BACKEND, DEVELOPER' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  audienceTeamTags?: string[];

  @ApiProperty({ required: false, type: [String], description: 'Specific PlatformUser ids to invite regardless of role/tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  invitedUserIds?: string[];

  @ApiProperty({ required: false, type: [String], description: 'HamzoneExternalContact ids — people outside the system to invite' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  externalContactIds?: string[];

  @ApiProperty({ required: false, type: [String], description: 'Agenda items, shown in order on the invite and the meeting card' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  agenda?: string[];
}
