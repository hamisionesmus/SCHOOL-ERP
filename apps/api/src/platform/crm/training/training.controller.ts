import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../../common/decorators/current-user.decorator';
import { HamzoneTrainingService } from './training.service';
import { UpsertTrainingDto } from './dto/upsert-training.dto';

@ApiTags('platform/crm/training')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform/crm/training')
export class HamzoneTrainingController {
  constructor(private readonly training: HamzoneTrainingService) {}

  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('track') track?: string, @Query('status') status?: string) {
    return this.training.list(page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined, track, status);
  }

  @Get('overview')
  overview() {
    return this.training.overview();
  }

  @Post()
  create(@Body() dto: UpsertTrainingDto, @CurrentUser() user: JwtUserPayload) {
    return this.training.create(dto, user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertTrainingDto) {
    return this.training.update(id, dto);
  }
}
