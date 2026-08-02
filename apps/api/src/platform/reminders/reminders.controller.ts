import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { RemindersService } from './reminders.service';

// Manual trigger for the daily reminder sweep — useful to confirm it's wired up correctly without
// waiting for the schedule, and harmless to call anytime since it's fully deduped either way.
@ApiTags('platform/reminders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole('SUPER_ADMIN')
@Controller('platform/reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post('run')
  run() {
    return this.remindersService.checkDeadlines();
  }
}
