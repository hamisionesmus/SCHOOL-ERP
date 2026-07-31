import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { HrService } from './hr.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/leave-requests')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload) {
    return this.hrService.listLeaveRequests(user);
  }

  @Post()
  create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateLeaveRequestDto) {
    return this.hrService.createLeaveRequest(user, dto);
  }

  @Patch(':id/approve')
  @RequirePermission('HR:EDIT')
  approve(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.hrService.approve(user, id);
  }

  @Patch(':id/reject')
  @RequirePermission('HR:EDIT')
  reject(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.hrService.reject(user, id);
  }
}
