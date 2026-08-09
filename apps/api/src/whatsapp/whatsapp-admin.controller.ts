import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePlatformRole } from '../common/decorators/require-platform-role.decorator';
import { WhatsAppService } from './whatsapp.service';

/** Super-Admin-only visibility into the WhatsApp message log — every school's traffic runs through
 * one shared business number, so this isn't scoped per-tenant the way most admin views are. */
@ApiTags('platform/whatsapp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole('SUPER_ADMIN')
@Controller('platform/whatsapp')
export class WhatsAppAdminController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  @Get('messages')
  listMessages() {
    return this.whatsAppService.listMessages();
  }
}
