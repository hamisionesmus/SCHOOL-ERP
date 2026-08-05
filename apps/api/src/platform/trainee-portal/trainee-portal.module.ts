import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TraineePortalService } from './trainee-portal.service';
import { TraineePortalController } from './trainee-portal.controller';
import { TraineePortalAdminController } from './trainee-portal-admin.controller';
import { TraineeAuthGuard } from './trainee-auth.guard';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [JwtModule.register({}), MessagingModule],
  controllers: [TraineePortalController, TraineePortalAdminController],
  providers: [TraineePortalService, TraineeAuthGuard],
})
export class TraineePortalModule {}
