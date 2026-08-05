import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { DailyLinkService } from './daily-link.service';
import { SubmitDailyRegisterDto } from './dto/submit-daily-register.dto';
import { NoTrainingDto } from './dto/no-training.dto';

// Entirely public — reached from the daily SMS/email link, before the trainer ever needs to log
// in. Same unauthenticated shape as ActivationController; the signed token itself carries identity
// and is scoped to exactly one calendar day (see DailyLinkService.verifyToken).
@ApiTags('public/daily-link')
@Controller('public/daily-link')
export class DailyLinkPublicController {
  constructor(private readonly dailyLink: DailyLinkService) {}

  @Get(':token')
  info(@Param('token') token: string) {
    return this.dailyLink.getInfo(token);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':token/no-training')
  noTraining(@Param('token') token: string, @Body() dto: NoTrainingDto) {
    return this.dailyLink.submitNoTraining(token, dto.reason);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':token/register')
  register(@Param('token') token: string, @Body() dto: SubmitDailyRegisterDto) {
    return this.dailyLink.submitRegister(token, dto);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':token/photo/:slot')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  photo(@Param('token') token: string, @Param('slot') slot: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const slotNum = slot === '1' ? 1 : slot === '2' ? 2 : null;
    if (!slotNum) throw new BadRequestException('slot must be 1 or 2 — exactly two photos are allowed per day');
    return this.dailyLink.savePhoto(token, slotNum, file);
  }
}
