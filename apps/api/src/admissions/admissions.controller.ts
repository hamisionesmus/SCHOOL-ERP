import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { AdmissionsService } from './admissions.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

@ApiTags('admissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('ADMISSION:MANAGE')
@Controller('admissions/applications')
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload) {
    return this.admissionsService.list(user);
  }

  @Post()
  create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateApplicationDto) {
    return this.admissionsService.create(user, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.admissionsService.updateStatus(user, id, dto);
  }

  @Post(':id/admit')
  admit(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.admissionsService.admit(user, id);
  }
}
