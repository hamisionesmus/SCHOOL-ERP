import { Controller, Get, Param, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { BackupsService } from './backups.service';

@ApiTags('platform/backups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole('SUPER_ADMIN')
@Controller('platform/backups')
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.backupsService.list(page ? Number(page) : 1, pageSize ? Number(pageSize) : 10);
  }

  // Declared before the `:filename` catch-all below so `/platform/backups/stats` doesn't get
  // swallowed as a download request for a file literally named "stats".
  @Get('stats')
  stats() {
    return this.backupsService.stats();
  }

  @Post('run')
  trigger() {
    return this.backupsService.trigger();
  }

  @Get(':filename')
  download(@Param('filename') filename: string) {
    const path = this.backupsService.resolvePath(filename);
    return new StreamableFile(createReadStream(path), {
      type: filename.endsWith('.sql') ? 'application/sql' : 'application/gzip',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
