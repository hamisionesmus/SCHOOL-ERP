import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../../common/decorators/current-user.decorator';
import { HamzoneProgramsService } from './programs.service';
import { HamzoneTrainersService } from '../trainers/trainers.service';
import { UpsertProgramDto } from './dto/upsert-program.dto';
import { UpdateProgramStatusDto } from './dto/update-status.dto';

@ApiTags('platform/training/programs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('platform/training/programs')
export class HamzoneProgramsController {
  constructor(
    private readonly programs: HamzoneProgramsService,
    private readonly trainers: HamzoneTrainersService,
  ) {}

  @RequirePlatformRole()
  @Get()
  list() {
    return this.programs.list();
  }

  @RequirePlatformRole('TRAINER')
  @Get('mine')
  async mine(@CurrentUser() user: JwtUserPayload) {
    const profile = await this.trainers.findByUserId(user.sub);
    return this.programs.listForTrainerProfile(profile.id);
  }

  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN', 'TRAINER'])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.programs.findOne(id);
  }

  @RequirePlatformRole()
  @Post()
  create(@Body() dto: UpsertProgramDto, @CurrentUser() user: JwtUserPayload) {
    return this.programs.create(dto, user.sub);
  }

  @RequirePlatformRole()
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertProgramDto) {
    return this.programs.update(id, dto);
  }

  // Lets an admin flip SCHEDULED -> ACTIVE (unblocking the trainer's daily-link resend, which only
  // ever looks at ACTIVE programs) without having to resend every other field on the program.
  @RequirePlatformRole()
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateProgramStatusDto) {
    return this.programs.updateStatus(id, dto.status);
  }
}
