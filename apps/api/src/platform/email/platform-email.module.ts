import { Module } from '@nestjs/common';
import { EMAIL_PROVIDER } from './email-provider.interface';
import { StubEmailProvider } from './stub-email.provider';

@Module({
  providers: [{ provide: EMAIL_PROVIDER, useClass: StubEmailProvider }],
  exports: [EMAIL_PROVIDER],
})
export class PlatformEmailModule {}
