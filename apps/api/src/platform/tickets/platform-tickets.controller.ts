import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { RequirePlatformModule } from '../../common/decorators/require-platform-module.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { PlatformTicketsService } from './platform-tickets.service';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { ResolveEscalationDto } from './dto/resolve-escalation.dto';
import { AddEscalationCommentDto } from './dto/add-escalation-comment.dto';

// Tickets are Super Admin + Sub-Admin only by default — Assistant Super Admin is scoped to
// finance/school creation and excluded here, same as it's excluded from Security/Backups/Admins,
// unless individually granted the TICKETS module (see PlatformAdminModuleGrant/PermissionsGuard).
@ApiTags('platform/tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN'])
@RequirePlatformModule('TICKETS')
@Controller('platform/tickets')
export class PlatformTicketsController {
  constructor(private readonly ticketsService: PlatformTicketsService) {}

  @Get()
  list() {
    return this.ticketsService.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  @Post(':id/comments')
  addComment(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: AddEscalationCommentDto) {
    return this.ticketsService.addComment(user, id, dto.body);
  }

  @Patch(':id/assign')
  @RequirePlatformRole('SUPER_ADMIN')
  assign(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: AssignTicketDto) {
    return this.ticketsService.assign(user, id, dto.assignedToId);
  }

  @Patch(':id/resolve')
  resolve(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: ResolveEscalationDto) {
    return this.ticketsService.resolve(user, id, dto.resolutionNote);
  }
}
