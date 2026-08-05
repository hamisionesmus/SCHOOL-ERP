import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { HamzoneOutreachService } from './outreach.service';
import { UpsertOutreachEntryDto } from './dto/upsert-outreach-entry.dto';
import { CreateEarningDto } from './dto/create-earning.dto';
import { CreateGigWorkerDto } from './dto/create-gig-worker.dto';

const ADMIN_AND_GIG_WORKER = ['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN', 'GIG_WORKER'] as const;

@ApiTags('platform/outreach')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('platform/outreach')
export class HamzoneOutreachController {
  constructor(private readonly outreach: HamzoneOutreachService) {}

  @RequirePlatformRole([...ADMIN_AND_GIG_WORKER])
  @Get('entries')
  list(@CurrentUser() user: JwtUserPayload) {
    return this.outreach.list(user.sub);
  }

  @RequirePlatformRole([...ADMIN_AND_GIG_WORKER])
  @Get('entries/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUserPayload) {
    return this.outreach.findOne(id, user.sub);
  }

  @RequirePlatformRole()
  @Post('entries')
  create(@Body() dto: UpsertOutreachEntryDto, @CurrentUser() user: JwtUserPayload) {
    return this.outreach.create(dto, user.sub);
  }

  @RequirePlatformRole()
  @Patch('entries/:id')
  update(@Param('id') id: string, @Body() dto: UpsertOutreachEntryDto, @CurrentUser() user: JwtUserPayload) {
    return this.outreach.update(id, dto, user.sub);
  }

  @RequirePlatformRole([...ADMIN_AND_GIG_WORKER])
  @Post('entries/:id/earnings')
  addEarning(@Param('id') id: string, @Body() dto: CreateEarningDto, @CurrentUser() user: JwtUserPayload) {
    return this.outreach.addEarning(id, dto, user.sub);
  }

  @RequirePlatformRole('SUPER_ADMIN')
  @Get('workers')
  listWorkers() {
    return this.outreach.listWorkers();
  }

  @RequirePlatformRole('SUPER_ADMIN')
  @Post('workers')
  createWorker(@Body() dto: CreateGigWorkerDto, @CurrentUser() user: JwtUserPayload) {
    return this.outreach.createWorker(dto, user.sub);
  }
}
