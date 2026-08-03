import { Module } from '@nestjs/common';
import { EMAIL_PROVIDER } from './email-provider.interface';
import { SmtpEmailProvider } from './smtp-email.provider';

// Binds SmtpEmailProvider — real outbound email via the self-hosted `postfix` relay (see
// docker-compose.prod.yml), falling back to StubEmailProvider (log-only) when SMTP_HOST isn't set.
// ResendEmailProvider is still available (resend-email.provider.ts) if a managed ESP is preferred
// later — swap the useClass below, no other call sites change.
@Module({
  providers: [{ provide: EMAIL_PROVIDER, useClass: SmtpEmailProvider }],
  exports: [EMAIL_PROVIDER],
})
export class PlatformEmailModule {}
