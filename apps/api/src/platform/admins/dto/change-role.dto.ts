import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const ALL_ROLES = ['SUPER_ADMIN', 'ASSISTANT_SUPER_ADMIN', 'SUB_ADMIN', 'TRAINER', 'GIG_WORKER', 'SOFTWARE_ENGINEER', 'STAFF'] as const;

export class ChangeRoleDto {
  @ApiProperty({ enum: ALL_ROLES })
  @IsIn(ALL_ROLES)
  role!: (typeof ALL_ROLES)[number];
}
