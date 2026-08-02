import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMS_PROVIDER, SmsProvider } from './providers/sms-provider.interface';
import { StubSmsProvider } from './providers/stub-sms.provider';
import { AdvantaSmsProvider } from './providers/advanta-sms.provider';

/**
 * Single source of truth for SMS_PROVIDER — imported by every module that needs to send SMS
 * (CommunicationsModule for tenant-side announcements, TenantsModule and ActivationModule for
 * platform-level welcome/activation notices) so there's exactly one place that decides real vs
 * stub, instead of each call site declaring its own binding.
 */
@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      useFactory: (config: ConfigService): SmsProvider =>
        config.get<string>('ADVANTA_API_KEY') ? new AdvantaSmsProvider(config) : new StubSmsProvider(),
      inject: [ConfigService],
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsProviderModule {}
