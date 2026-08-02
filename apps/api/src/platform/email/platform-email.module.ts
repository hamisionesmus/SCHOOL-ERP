import { Module } from '@nestjs/common';
import { EMAIL_PROVIDER } from './email-provider.interface';
import { ResendEmailProvider } from './resend-email.provider';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

// Always binds ResendEmailProvider — it internally falls back to StubEmailProvider (log-only) when
// neither a DB-configured nor env-configured RESEND_API_KEY is present, resolved per call rather
// than once at boot. This is what lets a Super Admin turn on real email from the Settings UI
// without a redeploy — see ResendEmailProvider's own doc comment.
@Module({
  imports: [PlatformSettingsModule],
  providers: [{ provide: EMAIL_PROVIDER, useClass: ResendEmailProvider }],
  exports: [EMAIL_PROVIDER],
})
export class PlatformEmailModule {}
