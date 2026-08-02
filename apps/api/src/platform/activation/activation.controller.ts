import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ActivationService } from './activation.service';
import { InitiateActivationPaymentDto } from './dto/initiate-activation-payment.dto';

// Entirely public — reached from the "activate your school" link in the welcome email, before the
// school has ever been able to log in. No JwtAuthGuard here, same shape as AuthController's
// login/refresh routes (the only other unauthenticated controller in this app).
@ApiTags('public/activation')
@Controller('public/activation')
export class ActivationController {
  constructor(private readonly activationService: ActivationService) {}

  @Get(':token')
  status(@Param('token') token: string) {
    return this.activationService.getStatus(token);
  }

  // Same rate-limiting instinct as AuthController.login — this triggers a real STK push prompt on
  // someone's phone, worth throttling harder than the app-wide default.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':token/pay')
  pay(@Param('token') token: string, @Body() dto: InitiateActivationPaymentDto) {
    return this.activationService.initiatePayment(token, dto.phone);
  }

  @Post('mpesa-callback')
  callback(@Body() body: unknown) {
    return this.activationService.handleCallback(body as Parameters<ActivationService['handleCallback']>[0]);
  }
}
