import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ActivationService } from './activation.service';
import { InitiateActivationPaymentDto } from './dto/initiate-activation-payment.dto';
import { SubmitPaymentProofDto } from './dto/submit-payment-proof.dto';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

// Entirely public — reached from the "activate your school" link in the welcome email, before the
// school has ever been able to log in. No JwtAuthGuard here, same shape as AuthController's
// login/refresh routes (the only other unauthenticated controller in this app).
@ApiTags('public/activation')
@Controller('public/activation')
export class ActivationController {
  constructor(
    private readonly activationService: ActivationService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  @Get(':token')
  status(@Param('token') token: string) {
    return this.activationService.getStatus(token);
  }

  @Get(':token/payment-details')
  paymentDetails() {
    return this.platformSettings.getPublicPaymentDetails();
  }

  // Same rate-limiting instinct as AuthController.login — this triggers a real STK push prompt on
  // someone's phone, worth throttling harder than the app-wide default.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':token/pay')
  pay(@Param('token') token: string, @Body() dto: InitiateActivationPaymentDto) {
    return this.activationService.initiatePayment(token, dto.phone);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':token/proof')
  submitProof(@Param('token') token: string, @Body() dto: SubmitPaymentProofDto) {
    return this.activationService.submitPaymentProof(token, dto.method, dto.message);
  }

  @Post('mpesa-callback')
  callback(@Body() body: unknown) {
    return this.activationService.handleCallback(body as Parameters<ActivationService['handleCallback']>[0]);
  }
}
