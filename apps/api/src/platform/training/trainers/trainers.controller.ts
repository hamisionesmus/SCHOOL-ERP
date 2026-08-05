import { Body, Controller, Get, Param, Patch, Post, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../../common/decorators/current-user.decorator';
import { HamzoneTrainersService } from './trainers.service';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { UpdateTrainerProfileDto } from './dto/update-trainer-profile.dto';

@ApiTags('platform/training/trainers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('platform/training/trainers')
export class HamzoneTrainersController {
  constructor(private readonly trainers: HamzoneTrainersService) {}

  @RequirePlatformRole()
  @Get()
  list() {
    return this.trainers.list();
  }

  @RequirePlatformRole('TRAINER')
  @Get('me')
  me(@CurrentUser() user: JwtUserPayload) {
    return this.trainers.findByUserId(user.sub);
  }

  @RequirePlatformRole()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trainers.findOne(id);
  }

  @RequirePlatformRole('SUPER_ADMIN')
  @Post()
  create(@Body() dto: CreateTrainerDto, @CurrentUser() user: JwtUserPayload) {
    return this.trainers.create(dto, user.sub);
  }

  @RequirePlatformRole()
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTrainerProfileDto) {
    return this.trainers.updateProfile(id, dto);
  }

  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN', 'TRAINER'])
  @Get(':id/contract')
  async contract(@Param('id') id: string, @CurrentUser() user: JwtUserPayload) {
    if (user.role === 'TRAINER') await this.trainers.assertOwnsProfile(id, user.sub);
    const { buffer, filename } = await this.trainers.contractPdf(id);
    return new StreamableFile(buffer, { type: 'application/pdf', disposition: `attachment; filename="${filename}"` });
  }

  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN', 'TRAINER'])
  @Get(':id/center-history')
  async centerHistory(@Param('id') id: string, @CurrentUser() user: JwtUserPayload) {
    if (user.role === 'TRAINER') await this.trainers.assertOwnsProfile(id, user.sub);
    return this.trainers.centerHistory(id);
  }
}
