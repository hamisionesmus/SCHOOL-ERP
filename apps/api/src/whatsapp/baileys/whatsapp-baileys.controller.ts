import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { WhatsAppBaileysService } from './whatsapp-baileys.service';

/** Super-Admin-only — connecting/disconnecting the platform's one shared WhatsApp number is a
 * platform-wide action, same visibility tier as the rest of the WhatsApp settings surface. */
@ApiTags('platform/whatsapp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole('SUPER_ADMIN')
@Controller('platform/whatsapp/baileys')
export class WhatsAppBaileysController {
  constructor(private readonly baileys: WhatsAppBaileysService) {}

  @Get('status')
  getStatus() {
    return this.baileys.getStatus();
  }

  @Post('connect')
  async connect() {
    await this.baileys.startConnection();
    return this.baileys.getStatus();
  }

  @Post('logout')
  async logout() {
    await this.baileys.logout();
    return this.baileys.getStatus();
  }
}
