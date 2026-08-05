import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HamzoneCentersController } from './centers/centers.controller';
import { HamzoneCentersService } from './centers/centers.service';
import { HamzoneTrainersController } from './trainers/trainers.controller';
import { HamzoneTrainersService } from './trainers/trainers.service';
import { HamzoneProgramsController } from './programs/programs.controller';
import { HamzoneProgramsService } from './programs/programs.service';
import { HamzoneRegistersController } from './registers/registers.controller';
import { HamzoneRegistersService } from './registers/registers.service';
import { HamzoneTrainerReportsController } from './reports/reports.controller';
import { HamzoneTrainerReportsService } from './reports/reports.service';
import { DailyLinkController } from './daily-link/daily-link.controller';
import { DailyLinkPublicController } from './daily-link/daily-link-public.controller';
import { DailyLinkService } from './daily-link/daily-link.service';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { MessagingModule } from '../messaging/messaging.module';
import { UserDirectoryModule } from '../../common/user-directory/user-directory.module';

@Module({
  imports: [JwtModule.register({}), PlatformSettingsModule, MessagingModule, UserDirectoryModule],
  controllers: [
    HamzoneCentersController,
    HamzoneTrainersController,
    HamzoneProgramsController,
    HamzoneRegistersController,
    HamzoneTrainerReportsController,
    DailyLinkController,
    DailyLinkPublicController,
  ],
  providers: [
    HamzoneCentersService,
    HamzoneTrainersService,
    HamzoneProgramsService,
    HamzoneRegistersService,
    HamzoneTrainerReportsService,
    DailyLinkService,
  ],
  exports: [HamzoneTrainersService],
})
export class TrainingModule {}
