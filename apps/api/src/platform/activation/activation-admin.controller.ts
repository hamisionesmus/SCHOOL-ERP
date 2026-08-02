import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { ActivationService } from './activation.service';
import { ReviewPaymentProofDto } from './dto/review-payment-proof.dto';

// Super-Admin-authenticated counterpart to ActivationController's public endpoints — reviewing
// Bank/Paybill proofs and viewing transaction history is a real login-gated action, unlike the
// school's own public activation flow.
@ApiTags('platform/activation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole()
@Controller('platform')
export class ActivationAdminController {
  constructor(private readonly activationService: ActivationService) {}

  @Get('tenants/:id/mpesa-attempts')
  mpesaAttempts(@Param('id') tenantId: string) {
    return this.activationService.listMpesaAttempts(tenantId);
  }

  @Get('tenants/:id/payment-proofs')
  paymentProofs(@Param('id') tenantId: string) {
    return this.activationService.listPaymentProofs(tenantId);
  }

  @Post('payment-proofs/:id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: JwtUserPayload, @Body() dto: ReviewPaymentProofDto) {
    return this.activationService.approveProof(id, user.sub, dto.reviewNote);
  }

  @Post('payment-proofs/:id/reject')
  reject(@Param('id') id: string, @CurrentUser() user: JwtUserPayload, @Body() dto: ReviewPaymentProofDto) {
    return this.activationService.rejectProof(id, user.sub, dto.reviewNote ?? 'Rejected');
  }
}
