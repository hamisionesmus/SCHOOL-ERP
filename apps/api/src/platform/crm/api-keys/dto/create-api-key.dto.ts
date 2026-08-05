import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsString } from 'class-validator';

export const HAMZONE_API_SCOPES = ['training:read', 'clients:read', 'documents:read', 'leads:write'] as const;

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Company website' })
  @IsString()
  label!: string;

  @ApiProperty({ enum: HAMZONE_API_SCOPES, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(HAMZONE_API_SCOPES, { each: true })
  scopes!: (typeof HAMZONE_API_SCOPES)[number][];
}
