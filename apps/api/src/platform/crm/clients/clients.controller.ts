import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../../common/decorators/current-user.decorator';
import { HamzoneClientsService } from './clients.service';
import { UpsertClientDto } from './dto/upsert-client.dto';
import { CreateClientNoteDto } from './dto/create-client-note.dto';

// Open to every platform admin tier — the CRM is explicitly "all admins are marketers as well" per
// how this was requested, not a Super-Admin-only surface like Security/Backups/Settings.
@ApiTags('platform/crm/clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform/crm/clients')
export class HamzoneClientsController {
  constructor(private readonly clients: HamzoneClientsService) {}

  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('q') q?: string) {
    return this.clients.list(page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined, q);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clients.findOne(id);
  }

  @Post()
  create(@Body() dto: UpsertClientDto, @CurrentUser() user: JwtUserPayload) {
    return this.clients.create(dto, user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertClientDto) {
    return this.clients.update(id, dto);
  }

  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body() dto: CreateClientNoteDto, @CurrentUser() user: JwtUserPayload) {
    return this.clients.addNote(id, dto, user.sub);
  }
}
