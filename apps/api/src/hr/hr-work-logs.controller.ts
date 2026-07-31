import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { HrService } from './hr.service';
import { CreateWorkLogDto } from './dto/create-work-log.dto';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/work-logs')
export class HrWorkLogsController {
  constructor(private readonly hrService: HrService) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload, @Query('staffUserId') staffUserId?: string) {
    return this.hrService.listWorkLogs(user, staffUserId);
  }

  // One entry per (staff, date) — resubmitting the same day updates it rather than duplicating.
  @Post()
  upsert(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateWorkLogDto) {
    return this.hrService.upsertWorkLog(user, dto);
  }
}
