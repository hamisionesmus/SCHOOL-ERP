import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../../common/decorators/current-user.decorator';
import { HamzoneCentersService } from './centers.service';
import { UpsertCenterDto } from './dto/upsert-center.dto';

// Read access includes TRAINER (they need to see their own center's info); managing centers stays
// admin-tier only (the bare-decorated POST/PATCH below default to admin tiers).
@ApiTags('platform/training/centers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('platform/training/centers')
export class HamzoneCentersController {
  constructor(private readonly centers: HamzoneCentersService) {}

  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN', 'TRAINER'])
  @Get()
  list() {
    return this.centers.list();
  }

  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN', 'TRAINER'])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.centers.findOne(id);
  }

  @RequirePlatformRole()
  @Post()
  create(@Body() dto: UpsertCenterDto, @CurrentUser() user: JwtUserPayload) {
    return this.centers.create(dto, user.sub);
  }

  @RequirePlatformRole()
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertCenterDto) {
    return this.centers.update(id, dto);
  }
}
