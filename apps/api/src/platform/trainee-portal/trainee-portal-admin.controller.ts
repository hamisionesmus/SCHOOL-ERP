import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { TraineePortalService } from './trainee-portal.service';
import { GrantPortalAccessDto } from './dto/grant-portal-access.dto';

/** Admin/trainer-side control over a trainee's portal access — split from TraineePortalController
 * (which is the trainee's own, differently-authenticated surface) since these two controllers use
 * completely different guards. */
@ApiTags('platform/training/trainees/portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN', 'TRAINER'])
@Controller('platform/training/trainees')
export class TraineePortalAdminController {
  constructor(private readonly traineePortal: TraineePortalService) {}

  // List/detail and bulk Excel operations are admin-tier only (no TRAINER) — overrides the
  // class-level guard. 'export'/'import-template' are declared before ':id' so they're never
  // shadowed by the param route.
  @Get()
  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'])
  list(@Query('programId') programId?: string) {
    return this.traineePortal.adminList(programId);
  }

  @Get('export')
  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'])
  async exportExcel() {
    const buffer = await this.traineePortal.exportExcel();
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="trainees-export.xlsx"',
    });
  }

  @Get('import-template')
  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'])
  async importTemplate() {
    const buffer = await this.traineePortal.importTemplateExcel();
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="trainees-import-template.xlsx"',
    });
  }

  @Get(':id')
  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'])
  findOne(@Param('id') id: string) {
    return this.traineePortal.adminFindOne(id);
  }

  @Patch(':id/grant-portal-access')
  grant(@Param('id') id: string, @Body() dto: GrantPortalAccessDto) {
    return this.traineePortal.grantAccess(id, dto);
  }

  @Patch(':id/revoke-portal-access')
  revoke(@Param('id') id: string) {
    return this.traineePortal.revokeAccess(id);
  }

  @Post('import')
  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'])
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importExcel(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    return this.traineePortal.importFromExcel(file.buffer);
  }
}
