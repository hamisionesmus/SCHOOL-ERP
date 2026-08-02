import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FeedbackService } from './feedback.service';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';

// Public — reached from the survey link in a demo-expiry reminder. No login required.
@ApiTags('public/feedback')
@Controller('public/feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get(':token')
  getSchoolName(@Param('token') token: string) {
    return this.feedbackService.getSchoolName(token);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':token')
  submit(@Param('token') token: string, @Body() dto: SubmitFeedbackDto) {
    return this.feedbackService.submit(token, dto);
  }
}
