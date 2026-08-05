import { Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';

/** A scheduled meeting with a Zoom/Google-Meet link, communicated in-app and via SMS/email — see
 * HamzoneMeeting's schema doc comment for how audience targeting resolves recipients. */
@Injectable()
export class HamzoneMeetingsService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly notifier: PlatformNotifierService,
  ) {}

  list() {
    return this.platformPrisma.hamzoneMeeting.findMany({
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  /** Every meeting the given user is part of the audience for — role match, team-tag overlap, or a
   * specific invite — plus anything they organized themselves. teamTags is looked up fresh here
   * (not carried in the JWT) since it's a lightweight, casually-edited label, not worth the
   * staleness/refresh-token plumbing a JWT-embedded field would need. */
  async listMine(userId: string, role: string) {
    const user = await this.platformPrisma.platformUser.findUnique({ where: { id: userId }, select: { teamTags: true } });
    const teamTags = user?.teamTags ?? [];
    return this.platformPrisma.hamzoneMeeting.findMany({
      where: {
        OR: [
          { createdByUserId: userId },
          { invitedUserIds: { has: userId } },
          { audienceRoles: { has: role } },
          ...(teamTags.length ? [{ audienceTeamTags: { hasSome: teamTags } }] : []),
        ],
      },
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const meeting = await this.platformPrisma.hamzoneMeeting.findUnique({
      where: { id },
      include: { createdBy: { select: { fullName: true } } },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  private async resolveRecipients(dto: CreateMeetingDto) {
    const where: object[] = [];
    if (dto.audienceRoles?.length) where.push({ role: { in: dto.audienceRoles } });
    if (dto.audienceTeamTags?.length) where.push({ teamTags: { hasSome: dto.audienceTeamTags } });
    if (dto.invitedUserIds?.length) where.push({ id: { in: dto.invitedUserIds } });
    if (where.length === 0) return [];

    return this.platformPrisma.platformUser.findMany({
      where: { OR: where, deletedAt: null },
      select: { email: true, phone: true },
    });
  }

  async create(dto: CreateMeetingDto, userId: string) {
    const meeting = await this.platformPrisma.hamzoneMeeting.create({
      data: {
        title: dto.title,
        description: dto.description,
        meetingLink: dto.meetingLink,
        scheduledAt: new Date(dto.scheduledAt),
        audienceRoles: dto.audienceRoles ?? [],
        audienceTeamTags: dto.audienceTeamTags ?? [],
        invitedUserIds: dto.invitedUserIds ?? [],
        createdByUserId: userId,
      },
      include: { createdBy: { select: { fullName: true } } },
    });

    const recipients = await this.resolveRecipients(dto);
    const scheduledLabel = meeting.scheduledAt.toLocaleString('en-KE');
    for (const r of recipients) {
      await this.notifier.notify('MEETING_INVITE', {
        to: { email: r.email, phone: r.phone },
        vars: {
          title: meeting.title,
          scheduledAt: scheduledLabel,
          meetingLink: meeting.meetingLink ?? 'Details in-app',
          organizerName: meeting.createdBy.fullName,
        },
      });
    }
    if (recipients.length > 0) {
      await this.platformPrisma.hamzoneMeeting.update({ where: { id: meeting.id }, data: { notifiedAt: new Date() } });
    }
    return meeting;
  }
}
