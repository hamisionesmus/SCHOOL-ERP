import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { PlatformFinanceService } from './finance.service';
import { CreateFinanceEntryDto } from './dto/create-finance-entry.dto';

@ApiTags('platform/finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole(['SUPER_ADMIN', 'ASSISTANT_SUPER_ADMIN'])
@Controller('platform/finance')
export class PlatformFinanceController {
  constructor(private readonly financeService: PlatformFinanceService) {}

  @Get('overview')
  overview() {
    return this.financeService.overview();
  }

  @Get('entries')
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.financeService.list(page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined);
  }

  @Post('entries')
  create(@Body() dto: CreateFinanceEntryDto, @CurrentUser() user: JwtUserPayload) {
    return this.financeService.create(dto, user.sub);
  }
}
