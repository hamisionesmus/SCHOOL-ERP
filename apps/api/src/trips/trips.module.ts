import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { CommunicationsModule } from '../communications/communications.module';

@Module({
  imports: [CommunicationsModule],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}
