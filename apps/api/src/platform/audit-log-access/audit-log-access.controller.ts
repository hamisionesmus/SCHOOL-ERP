import { Body, Controller, Get, Param, Post, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { AuditLogAccessService } from './audit-log-access.service';

class ConfirmAccessDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

@ApiTags('platform/audit-log-access')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform')
export class AuditLogAccessController {
  constructor(private readonly service: AuditLogAccessService) {}

  @Post('tenants/:id/audit-log-access/request')
  request(@Param('id') id: string, @CurrentUser() user: JwtUserPayload) {
    return this.service.request(id, user.sub);
  }

  @Get('tenants/:id/audit-log-access/requests')
  list(@Param('id') id: string) {
    return this.service.listForTenant(id);
  }

  @Post('audit-log-access/:requestId/confirm')
  confirm(@Param('requestId') requestId: string, @Body() dto: ConfirmAccessDto) {
    return this.service.confirm(requestId, dto.code);
  }

  @Get('audit-log-access/:requestId/status')
  status(@Param('requestId') requestId: string) {
    return this.service.status(requestId);
  }

  @Get('audit-log-access/:requestId/download')
  async download(@Param('requestId') requestId: string) {
    const { buffer, filename } = await this.service.download(requestId);
    return new StreamableFile(buffer, {
      type: 'text/csv',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post('audit-log-access/:requestId/share')
  share(@Param('requestId') requestId: string) {
    return this.service.shareWithSchool(requestId);
  }
}
