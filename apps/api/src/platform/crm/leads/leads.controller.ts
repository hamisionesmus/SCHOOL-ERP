import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../../common/decorators/current-user.decorator';
import { HamzoneLeadsService } from './leads.service';
import { UpsertLeadDto } from './dto/upsert-lead.dto';

@ApiTags('platform/crm/leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform/crm/leads')
export class HamzoneLeadsController {
  constructor(private readonly leads: HamzoneLeadsService) {}

  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('status') status?: string) {
    return this.leads.list(page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined, status);
  }

  @Post()
  create(@Body() dto: UpsertLeadDto, @CurrentUser() user: JwtUserPayload) {
    return this.leads.create(dto, user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertLeadDto) {
    return this.leads.update(id, dto);
  }
}
