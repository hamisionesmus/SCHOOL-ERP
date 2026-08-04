import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { PresenceService } from './presence.service';

// Same visibility tier as System Health/Finance: Super Admin + Assistant Super Admin, Sub-Admin
// excluded. REST fallback for the initial page load / a manual refresh — PresenceGateway's
// WebSocket broadcast is the live-updating path once connected.
@ApiTags('platform/presence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole(['SUPER_ADMIN', 'ASSISTANT_SUPER_ADMIN'])
@Controller('platform/presence')
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  @Get()
  snapshot() {
    return this.presence.snapshot();
  }
}
