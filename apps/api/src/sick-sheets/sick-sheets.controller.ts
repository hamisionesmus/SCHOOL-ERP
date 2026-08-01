import { Body, Controller, Get, Param, Post, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { SickSheetsService } from './sick-sheets.service';
import { CreateSickSheetDto } from './dto/create-sick-sheet.dto';

@ApiTags('sick-sheets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sick-sheets')
export class SickSheetsController {
  constructor(private readonly sickSheetsService: SickSheetsService) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload) {
    return this.sickSheetsService.list(user);
  }

  @Post()
  @RequirePermission('HEALTH:ISSUE_SICK_SHEET')
  create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateSickSheetDto) {
    return this.sickSheetsService.create(user, dto);
  }

  @Get(':id/pdf')
  async pdf(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    const { buffer, filename } = await this.sickSheetsService.pdf(user, id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
