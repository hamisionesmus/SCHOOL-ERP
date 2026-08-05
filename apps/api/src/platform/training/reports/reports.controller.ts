import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../../common/decorators/current-user.decorator';
import { HamzoneTrainerReportsService } from './reports.service';
import { HamzoneTrainersService } from '../trainers/trainers.service';
import { CreateTrainerReportDto } from './dto/create-report.dto';

@ApiTags('platform/training/reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('platform/training/reports')
export class HamzoneTrainerReportsController {
  constructor(
    private readonly reports: HamzoneTrainerReportsService,
    private readonly trainers: HamzoneTrainersService,
  ) {}

  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'])
  @Get()
  list(@Query('trainerId') trainerId?: string) {
    return this.reports.list(trainerId);
  }

  @RequirePlatformRole('TRAINER')
  @Get('mine')
  async mine(@CurrentUser() user: JwtUserPayload) {
    const profile = await this.trainers.findByUserId(user.sub);
    return this.reports.list(profile.id);
  }

  @RequirePlatformRole('TRAINER')
  @Post()
  async create(@Body() dto: CreateTrainerReportDto, @CurrentUser() user: JwtUserPayload) {
    const profile = await this.trainers.findByUserId(user.sub);
    return this.reports.create(dto, profile.id);
  }
}
