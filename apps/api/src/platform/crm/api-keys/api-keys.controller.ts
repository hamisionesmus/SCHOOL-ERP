import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../../common/decorators/current-user.decorator';
import { HamzoneApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

// Credential management stays Super-Admin-only, same trust boundary as every other secret this
// platform issues (Mpesa/Resend/Advanta config, mailbox passwords) — unlike the rest of the CRM,
// which is open to every admin tier.
@ApiTags('platform/crm/api-keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole('SUPER_ADMIN')
@Controller('platform/crm/api-keys')
export class HamzoneApiKeysController {
  constructor(private readonly apiKeys: HamzoneApiKeysService) {}

  @Get()
  list() {
    return this.apiKeys.list();
  }

  @Post()
  create(@Body() dto: CreateApiKeyDto, @CurrentUser() user: JwtUserPayload) {
    return this.apiKeys.create(dto, user.sub);
  }

  @Delete(':id')
  revoke(@Param('id') id: string) {
    return this.apiKeys.revoke(id);
  }
}
