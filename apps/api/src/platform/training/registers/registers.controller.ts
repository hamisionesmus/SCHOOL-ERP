import { Body, Controller, Get, Param, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../../common/decorators/current-user.decorator';
import { HamzoneRegistersService } from './registers.service';
import { HamzoneTrainersService } from '../trainers/trainers.service';
import { CreateRegisterDto } from './dto/create-register.dto';

@ApiTags('platform/training/registers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('platform/training/registers')
export class HamzoneRegistersController {
  constructor(
    private readonly registers: HamzoneRegistersService,
    private readonly trainers: HamzoneTrainersService,
  ) {}

  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'])
  @Get()
  list(@Query('programId') programId?: string, @Query('trainerId') trainerId?: string) {
    return this.registers.list(programId, trainerId);
  }

  @RequirePlatformRole('TRAINER')
  @Get('mine')
  async mine(@CurrentUser() user: JwtUserPayload, @Query('programId') programId?: string) {
    const profile = await this.trainers.findByUserId(user.sub);
    return this.registers.list(programId, profile.id);
  }

  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN', 'TRAINER'])
  @Get('stats')
  async stats(@Query('programId') programId: string, @CurrentUser() user: JwtUserPayload) {
    if (user.role === 'TRAINER') {
      const profile = await this.trainers.findByUserId(user.sub);
      return this.registers.stats(programId, profile.id);
    }
    return this.registers.stats(programId);
  }

  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN', 'TRAINER'])
  @Get(':id/attendance')
  async attendanceDetail(@Param('id') id: string, @CurrentUser() user: JwtUserPayload) {
    if (user.role === 'TRAINER') {
      const profile = await this.trainers.findByUserId(user.sub);
      return this.registers.attendanceDetail(id, profile.id);
    }
    return this.registers.attendanceDetail(id);
  }

  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN', 'TRAINER'])
  @Get(':id/pdf')
  async pdf(@Param('id') id: string) {
    const { buffer, filename } = await this.registers.pdf(id);
    return new StreamableFile(buffer, { type: 'application/pdf', disposition: `attachment; filename="${filename}"` });
  }

  // The trainer's own identity resolves who they're submitting as — a trainer can never submit a
  // register under another trainer's name by passing a different trainerId in the body.
  @RequirePlatformRole('TRAINER')
  @Post()
  async create(@Body() dto: CreateRegisterDto, @CurrentUser() user: JwtUserPayload) {
    const profile = await this.trainers.findByUserId(user.sub);
    return this.registers.create(dto, profile.id);
  }
}
