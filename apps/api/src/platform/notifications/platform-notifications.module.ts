import { Module } from '@nestjs/common';
import { PlatformNotificationsController } from './platform-notifications.controller';
import { PlatformNotificationsService } from './platform-notifications.service';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { MailboxesModule } from '../mailboxes/mailboxes.module';

@Module({
  imports: [PlatformSettingsModule, MailboxesModule],
  controllers: [PlatformNotificationsController],
  providers: [PlatformNotificationsService],
})
export class PlatformNotificationsModule {}
