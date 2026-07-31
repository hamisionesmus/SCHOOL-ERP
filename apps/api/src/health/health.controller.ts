import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { HealthService } from './health.service';
import { CreateMedicalAlertDto } from './dto/create-medical-alert.dto';
import { CreateClinicVisitDto } from './dto/create-clinic-visit.dto';

@ApiTags('health')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('medical-alerts')
  listMedicalAlerts(@CurrentUser() user: JwtUserPayload) {
    return this.healthService.listMedicalAlerts(user);
  }

  @Post('medical-alerts')
  @RequirePermission('HEALTH:MANAGE')
  createMedicalAlert(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateMedicalAlertDto) {
    return this.healthService.createMedicalAlert(user, dto);
  }

  @Get('clinic-visits')
  listClinicVisits(@CurrentUser() user: JwtUserPayload) {
    return this.healthService.listClinicVisits(user);
  }

  @Post('clinic-visits')
  @RequirePermission('HEALTH:MANAGE')
  createClinicVisit(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateClinicVisitDto) {
    return this.healthService.createClinicVisit(user, dto);
  }
}
