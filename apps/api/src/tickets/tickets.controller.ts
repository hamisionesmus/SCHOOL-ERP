import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketCommentDto } from './dto/create-comment.dto';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';
import { EscalateTicketDto } from './dto/escalate-ticket.dto';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtUserPayload) {
    return this.ticketsService.list(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.ticketsService.findOne(user, id);
  }

  @Post(':id/comments')
  addComment(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: CreateTicketCommentDto) {
    return this.ticketsService.addComment(user, id, dto);
  }

  @Patch(':id/resolve')
  @RequirePermission('TICKET:MANAGE')
  resolve(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: ResolveTicketDto) {
    return this.ticketsService.resolve(user, id, dto);
  }

  @Patch(':id/escalate')
  @RequirePermission('TICKET:MANAGE')
  escalate(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: EscalateTicketDto) {
    return this.ticketsService.escalate(user, id, dto);
  }
}
