import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { ExternalContactsService } from './external-contacts.service';
import { CreateExternalContactDto } from './dto/create-external-contact.dto';

// Admin-tier only — the same callers who can schedule a meeting or send a campaign are the only
// ones who need to add/browse external contacts for those flows.
@ApiTags('platform/external-contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform/external-contacts')
export class ExternalContactsController {
  constructor(private readonly externalContacts: ExternalContactsService) {}

  @Get()
  list(@Query('q') q?: string) {
    return this.externalContacts.list(q);
  }

  @Post()
  create(@Body() dto: CreateExternalContactDto, @CurrentUser() user: JwtUserPayload) {
    return this.externalContacts.findOrCreate(dto, user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.externalContacts.remove(id);
  }
}
