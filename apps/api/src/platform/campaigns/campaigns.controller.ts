import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, CampaignTargetsDto } from './dto/create-campaign.dto';

// Same visibility tier as Finance/System Health — Sub-Admin excluded, a bulk broadcast to every
// school/admin is a more consequential action than day-to-day ticket handling.
@ApiTags('platform/campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole(['SUPER_ADMIN', 'ASSISTANT_SUPER_ADMIN'])
@Controller('platform/campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.campaigns.list(page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaigns.findOne(id);
  }

  @Post('preview-recipients')
  preview(@Body() dto: CampaignTargetsDto) {
    return this.campaigns.previewRecipients(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(@Body() dto: CreateCampaignDto, @CurrentUser() user: JwtUserPayload) {
    return this.campaigns.create(dto, user.sub);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.campaigns.cancel(id);
  }
}
