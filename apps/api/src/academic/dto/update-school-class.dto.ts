import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateSchoolClassDto {
  @ApiPropertyOptional({
    description: 'A user id to assign as class teacher, or null to unassign. Omit to leave unchanged.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => o.classTeacherId !== null)
  @IsString()
  classTeacherId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}
