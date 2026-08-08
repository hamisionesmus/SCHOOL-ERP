import { BadRequestException, Body, Controller, Get, Post, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('TENANT:MANAGE_USERS')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload) {
    return this.usersService.list(user);
  }

  @Get('export')
  async exportExcel(@CurrentUser() user: JwtUserPayload) {
    const buffer = await this.usersService.exportExcel(user);
    return new StreamableFile(buffer, { type: XLSX_TYPE, disposition: 'attachment; filename="staff-export.xlsx"' });
  }

  @Get('import-template')
  async importTemplate() {
    const buffer = await this.usersService.importTemplateExcel();
    return new StreamableFile(buffer, { type: XLSX_TYPE, disposition: 'attachment; filename="staff-import-template.xlsx"' });
  }

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importExcel(@CurrentUser() user: JwtUserPayload, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    return this.usersService.importFromExcel(user, file.buffer);
  }

  @Post()
  async create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateUserDto) {
    return this.usersService.create(user, dto);
  }
}
