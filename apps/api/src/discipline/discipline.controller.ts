import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { DisciplineService } from './discipline.service';
import { CreateCaseDto } from './dto/create-case.dto';

@ApiTags('discipline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('discipline')
export class DisciplineController {
  constructor(private readonly disciplineService: DisciplineService) {}

  @Get('cases')
  listCases(@CurrentUser() user: JwtUserPayload) {
    return this.disciplineService.listCases(user);
  }

  @Post('cases')
  @RequirePermission('DISCIPLINE:MANAGE')
  createCase(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateCaseDto) {
    return this.disciplineService.createCase(user, dto);
  }
}
