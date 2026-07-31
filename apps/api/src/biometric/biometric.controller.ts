import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { BiometricService } from './biometric.service';
import { LogBiometricEventDto } from './dto/log-biometric-event.dto';

@ApiTags('biometric')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('biometric-events')
export class BiometricController {
  constructor(private readonly biometricService: BiometricService) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload) {
    return this.biometricService.list(user);
  }

  // Stands in for a real device webhook — see BiometricService's class comment.
  @Post()
  @RequirePermission('BIOMETRIC:MANAGE')
  log(@CurrentUser() user: JwtUserPayload, @Body() dto: LogBiometricEventDto) {
    return this.biometricService.logEvent(user, dto);
  }

  // No DELETE route exists anywhere in this module — events are archived, never removed.
  @Patch(':id/archive')
  @RequirePermission('BIOMETRIC:MANAGE')
  archive(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.biometricService.archive(user, id);
  }
}
