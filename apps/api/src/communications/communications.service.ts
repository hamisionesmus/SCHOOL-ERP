import { Inject, Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { SMS_PROVIDER, SmsProvider } from './providers/sms-provider.interface';

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  /** Sends via the configured SmsProvider and logs the attempt as an SmsMessage row regardless of
   * outcome, so delivery history is auditable even when the provider fails. */
  async sendToUserId(tenantSchema: string, recipientUserId: string, body: string) {
    const db = this.tenantPrisma.forSchema(tenantSchema);
    const recipient = await db.user.findUnique({ where: { id: recipientUserId } });
    const phone = recipient?.phone ?? 'N/A';
    const result = await this.smsProvider.send(phone, body);
    return db.smsMessage.create({
      data: {
        recipientUserId,
        recipientPhone: phone,
        body,
        status: result.success ? 'SENT' : 'FAILED',
      },
    });
  }

  async sendAnnouncement(user: JwtUserPayload, recipientUserIds: string[], body: string) {
    return Promise.all(recipientUserIds.map((id) => this.sendToUserId(user.tenantSchema!, id, body)));
  }

  async listMessages(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];

    if (perms.includes('ANNOUNCEMENT:SEND_TO_PARENTS')) {
      return db.smsMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    }
    return db.smsMessage.findMany({
      where: { recipientUserId: user.sub },
      orderBy: { createdAt: 'desc' },
    });
  }
}
