import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TraineePortalService } from './trainee-portal.service';
import { TraineeAuthGuard } from './trainee-auth.guard';
import { CurrentTrainee } from './current-trainee.decorator';
import { TraineeTokenPayload } from './trainee-auth.guard';
import { TraineeLoginDto } from './dto/trainee-login.dto';

@ApiTags('trainee-portal')
@Controller('trainee-portal')
export class TraineePortalController {
  constructor(private readonly traineePortal: TraineePortalService) {}

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: TraineeLoginDto) {
    return this.traineePortal.login(dto.email, dto.password);
  }

  @ApiBearerAuth()
  @UseGuards(TraineeAuthGuard)
  @Get('me')
  me(@CurrentTrainee() trainee: TraineeTokenPayload) {
    return this.traineePortal.getMe(trainee.traineeId);
  }

  @ApiBearerAuth()
  @UseGuards(TraineeAuthGuard)
  @Get('progress')
  progress(@CurrentTrainee() trainee: TraineeTokenPayload) {
    return this.traineePortal.getProgress(trainee.traineeId);
  }

  @ApiBearerAuth()
  @UseGuards(TraineeAuthGuard)
  @Get('materials')
  materials(@CurrentTrainee() trainee: TraineeTokenPayload) {
    return this.traineePortal.getMaterials(trainee.traineeId);
  }
}
