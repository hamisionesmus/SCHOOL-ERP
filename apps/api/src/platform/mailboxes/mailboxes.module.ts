import { Module } from '@nestjs/common';
import { MailboxesController } from './mailboxes.controller';
import { MailboxesService } from './mailboxes.service';
import { SettingsOtpModule } from '../settings-otp/settings-otp.module';

@Module({
  imports: [SettingsOtpModule],
  controllers: [MailboxesController],
  providers: [MailboxesService],
  exports: [MailboxesService],
})
export class MailboxesModule {}
