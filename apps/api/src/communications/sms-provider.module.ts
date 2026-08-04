import { Module } from '@nestjs/common';
import { SMS_PROVIDER } from './providers/sms-provider.interface';
import { AdvantaSmsProvider } from './providers/advanta-sms.provider';
import { PlatformSettingsModule } from '../platform/platform-settings/platform-settings.module';

/**
 * Single source of truth for SMS_PROVIDER — imported by every module that needs to send SMS
 * (CommunicationsModule for tenant-side announcements, TenantsModule and ActivationModule for
 * platform-level welcome/activation notices) so there's exactly one place that decides the binding.
 * Always binds AdvantaSmsProvider — it internally falls back to StubSmsProvider (log-only) when no
 * DB- or env-configured credentials are present, resolved per call — see its own doc comment.
 */
@Module({
  imports: [PlatformSettingsModule],
  // AdvantaSmsProvider is also exported by its concrete class (not just the SMS_PROVIDER token) so
  // SystemHealthModule can call its Advanta-specific getBalance() method, which isn't part of the
  // generic SmsProvider interface every other call site depends on.
  providers: [AdvantaSmsProvider, { provide: SMS_PROVIDER, useExisting: AdvantaSmsProvider }],
  exports: [SMS_PROVIDER, AdvantaSmsProvider],
})
export class SmsProviderModule {}
