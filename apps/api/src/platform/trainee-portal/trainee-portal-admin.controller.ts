import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { TraineePortalService } from './trainee-portal.service';
import { GrantPortalAccessDto } from './dto/grant-portal-access.dto';

/** Admin/trainer-side control over a trainee's portal access — split from TraineePortalController
 * (which is the trainee's own, differently-authenticated surface) since these two controllers use
 * completely different guards. */
@ApiTags('platform/training/trainees/portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN', 'TRAINER'])
@Controller('platform/training/trainees')
export class TraineePortalAdminController {
  constructor(private readonly traineePortal: TraineePortalService) {}

  @Patch(':id/grant-portal-access')
  grant(@Param('id') id: string, @Body() dto: GrantPortalAccessDto) {
    return this.traineePortal.grantAccess(id, dto);
  }

  @Patch(':id/revoke-portal-access')
  revoke(@Param('id') id: string) {
    return this.traineePortal.revokeAccess(id);
  }
}
