import { Module } from '@nestjs/common';
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
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { MessagingModule } from '../messaging/messaging.module';
import { UserDirectoryModule } from '../../common/user-directory/user-directory.module';

@Module({
  imports: [PlatformSettingsModule, MessagingModule, UserDirectoryModule],
  controllers: [
    HamzoneCentersController,
    HamzoneTrainersController,
    HamzoneProgramsController,
    HamzoneRegistersController,
    HamzoneTrainerReportsController,
  ],
  providers: [
    HamzoneCentersService,
    HamzoneTrainersService,
    HamzoneProgramsService,
    HamzoneRegistersService,
    HamzoneTrainerReportsService,
  ],
  exports: [HamzoneTrainersService],
})
export class TrainingModule {}
