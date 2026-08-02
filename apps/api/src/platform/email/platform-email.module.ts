import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER, EmailProvider } from './email-provider.interface';
import { StubEmailProvider } from './stub-email.provider';
import { ResendEmailProvider } from './resend-email.provider';

@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useFactory: (config: ConfigService): EmailProvider =>
        config.get<string>('RESEND_API_KEY') ? new ResendEmailProvider(config) : new StubEmailProvider(),
      inject: [ConfigService],
    },
  ],
  exports: [EMAIL_PROVIDER],
})
export class PlatformEmailModule {}
