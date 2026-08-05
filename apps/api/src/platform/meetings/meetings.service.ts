import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';

const ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'];

interface MeetingJoinTokenPayload {
  purpose: 'meeting-join';
  meetingId: string;
}

interface AudienceSelector {
  audienceRoles?: string[];
  audienceTeamTags?: string[];
  invitedUserIds?: string[];
  externalContactIds?: string[];
}

/** A scheduled meeting with a Zoom/Google-Meet link, communicated in-app and via SMS/email — see
 * HamzoneMeeting's schema doc comment for how audience targeting resolves recipients. Attendance is
 * self-reported via a personalized join link (see signJoinToken/recordJoin) — the same magic-link
 * pattern already proven by the daily training-register system, minus the day-scoping since a
 * meeting is a one-off event rather than a recurring daily one. */
@Injectable()
export class HamzoneMeetingsService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly notifier: PlatformNotifierService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  list() {
    return this.platformPrisma.hamzoneMeeting.findMany({
      include: { createdBy: { select: { fullName: true } }, _count: { select: { attendance: true } } },
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
      include: { createdBy: { select: { fullName: true } }, _count: { select: { attendance: true } } },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const meeting = await this.platformPrisma.hamzoneMeeting.findUnique({
      where: { id },
      include: { createdBy: { select: { fullName: true } }, _count: { select: { attendance: true } } },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  /** {email, phone, name} for every resolved invitee — union of role match, team-tag overlap,
   * specific PlatformUser invites, and external contacts. Accepts either the create DTO (at
   * creation time) or the persisted meeting row itself (for attendance/join lookups afterward) —
   * both share the same four audience fields. */
  private async resolveRecipients(selector: AudienceSelector) {
    const where: object[] = [];
    if (selector.audienceRoles?.length) where.push({ role: { in: selector.audienceRoles } });
    if (selector.audienceTeamTags?.length) where.push({ teamTags: { hasSome: selector.audienceTeamTags } });
    if (selector.invitedUserIds?.length) where.push({ id: { in: selector.invitedUserIds } });

    const [users, externalContacts] = await Promise.all([
      where.length
        ? this.platformPrisma.platformUser.findMany({
            where: { OR: where, deletedAt: null },
            select: { email: true, phone: true, fullName: true },
          })
        : Promise.resolve([]),
      selector.externalContactIds?.length
        ? this.platformPrisma.hamzoneExternalContact.findMany({
            where: { id: { in: selector.externalContactIds } },
            select: { email: true, phone: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    return [
      ...users.map((u) => ({ email: u.email, phone: u.phone, name: u.fullName })),
      ...externalContacts.map((c) => ({ email: c.email, phone: c.phone, name: c.name })),
    ];
  }

  private agendaListText(agenda: string[]): string {
    return agenda.length ? agenda.map((item, i) => `${i + 1}. ${item}`).join('\n') : 'No agenda items listed.';
  }

  /** Signed at send time — one shared token per meeting (not per invitee), so every invite email
   * carries the same link differing only by the ?email= query param the recipient's own address is
   * pre-filled into. Expires 24h after the meeting so late joiners can still be marked present. */
  private async signJoinToken(meetingId: string, scheduledAt: Date): Promise<string> {
    const expiresInSec = Math.max(Math.floor((scheduledAt.getTime() + 24 * 60 * 60 * 1000 - Date.now()) / 1000), 60 * 60);
    return this.jwt.signAsync({ purpose: 'meeting-join', meetingId } satisfies MeetingJoinTokenPayload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: expiresInSec,
    });
  }

  private async verifyJoinToken(token: string): Promise<string> {
    let decoded: MeetingJoinTokenPayload;
    try {
      decoded = await this.jwt.verifyAsync<MeetingJoinTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new BadRequestException('This meeting link is invalid or has expired.');
    }
    if (decoded.purpose !== 'meeting-join') throw new BadRequestException('This link is invalid.');
    return decoded.meetingId;
  }

  async create(dto: CreateMeetingDto, userId: string) {
    const meeting = await this.platformPrisma.hamzoneMeeting.create({
      data: {
        title: dto.title,
        description: dto.description,
        agenda: dto.agenda ?? [],
        meetingLink: dto.meetingLink,
        scheduledAt: new Date(dto.scheduledAt),
        audienceRoles: dto.audienceRoles ?? [],
        audienceTeamTags: dto.audienceTeamTags ?? [],
        invitedUserIds: dto.invitedUserIds ?? [],
        externalContactIds: dto.externalContactIds ?? [],
        createdByUserId: userId,
      },
      include: { createdBy: { select: { fullName: true } } },
    });

    const recipients = await this.resolveRecipients(dto);
    const scheduledLabel = meeting.scheduledAt.toLocaleString('en-KE');
    const agendaList = this.agendaListText(meeting.agenda);
    const token = recipients.some((r) => r.email) ? await this.signJoinToken(meeting.id, meeting.scheduledAt) : null;
    const webOrigin = this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';

    for (const r of recipients) {
      const joinUrl = token && r.email ? `${webOrigin}/meetings/join/${token}?email=${encodeURIComponent(r.email)}` : (meeting.meetingLink ?? 'Details in-app');
      await this.notifier.notify('MEETING_INVITE', {
        to: { email: r.email, phone: r.phone },
        vars: {
          title: meeting.title,
          scheduledAt: scheduledLabel,
          meetingLink: meeting.meetingLink ?? 'Details in-app',
          organizerName: meeting.createdBy.fullName,
          agendaList,
          joinUrl,
        },
      });
    }
    if (recipients.length > 0) {
      await this.platformPrisma.hamzoneMeeting.update({ where: { id: meeting.id }, data: { notifiedAt: new Date() } });
    }
    return meeting;
  }

  /** Public — reached from the personalized join link. Returns enough to render the join page
   * without requiring login; `invitedEmailMatched`/`alreadyJoined` only resolve once an email is
   * supplied (pre-filled from the link's own query param, editable on the page). */
  async getJoinInfo(token: string, email?: string) {
    const meetingId = await this.verifyJoinToken(token);
    const meeting = await this.platformPrisma.hamzoneMeeting.findUnique({
      where: { id: meetingId },
      include: { createdBy: { select: { fullName: true } } },
    });
    if (!meeting) throw new NotFoundException('This meeting no longer exists.');

    const normalizedEmail = email?.trim().toLowerCase();
    let invitedEmailMatched = false;
    let alreadyJoined = false;
    if (normalizedEmail) {
      const recipients = await this.resolveRecipients(meeting);
      invitedEmailMatched = recipients.some((r) => r.email?.toLowerCase() === normalizedEmail);
      const existing = await this.platformPrisma.hamzoneMeetingAttendance.findUnique({
        where: { meetingId_email: { meetingId, email: normalizedEmail } },
      });
      alreadyJoined = !!existing;
    }

    return {
      title: meeting.title,
      description: meeting.description,
      agenda: meeting.agenda,
      scheduledAt: meeting.scheduledAt,
      meetingLink: meeting.meetingLink,
      organizerName: meeting.createdBy.fullName,
      invitedEmailMatched,
      alreadyJoined,
    };
  }

  /** Public — records the join. Matching is best-effort (case-insensitive email compare against the
   * resolved audience) and never blocks the visitor from reaching the meeting link either way — an
   * unmatched join still opens the door, it's just excluded from the official present/absent tally
   * (see attendanceSummary). */
  async recordJoin(token: string, email: string, name?: string) {
    const meetingId = await this.verifyJoinToken(token);
    const meeting = await this.platformPrisma.hamzoneMeeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('This meeting no longer exists.');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new BadRequestException('Enter the email address you were invited with.');

    const recipients = await this.resolveRecipients(meeting);
    const matched = recipients.find((r) => r.email?.toLowerCase() === normalizedEmail);

    await this.platformPrisma.hamzoneMeetingAttendance.upsert({
      where: { meetingId_email: { meetingId, email: normalizedEmail } },
      create: { meetingId, email: normalizedEmail, name: matched?.name ?? name, matched: !!matched },
      update: { name: matched?.name ?? name, matched: !!matched },
    });

    return { joined: true, matched: !!matched, meetingLink: meeting.meetingLink };
  }

  /** Present/absent is always computed at read time against the currently-resolved audience rather
   * than snapshotted — so editing who's invited after the fact never leaves stale rows behind. */
  async attendanceSummary(id: string) {
    const meeting = await this.platformPrisma.hamzoneMeeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const [recipients, records] = await Promise.all([
      this.resolveRecipients(meeting),
      this.platformPrisma.hamzoneMeetingAttendance.findMany({ where: { meetingId: id }, orderBy: { joinedAt: 'asc' } }),
    ]);

    const seenEmails = new Set<string>();
    const invitedUnique = recipients.filter((r) => {
      if (!r.email) return false;
      const e = r.email.toLowerCase();
      if (seenEmails.has(e)) return false;
      seenEmails.add(e);
      return true;
    });

    const presentEmails = new Set(records.filter((r) => r.matched).map((r) => r.email));
    const present = invitedUnique
      .filter((r) => presentEmails.has(r.email!.toLowerCase()))
      .map((r) => ({ email: r.email, name: r.name, joinedAt: records.find((rec) => rec.email === r.email!.toLowerCase())?.joinedAt }));
    const absent = invitedUnique.filter((r) => !presentEmails.has(r.email!.toLowerCase())).map((r) => ({ email: r.email, name: r.name }));
    const extraJoins = records
      .filter((r) => !r.matched)
      .map((r) => ({ email: r.email, name: r.name, joinedAt: r.joinedAt }));

    return {
      totalInvited: invitedUnique.length,
      totalPresent: present.length,
      totalAbsent: absent.length,
      present,
      absent,
      extraJoins,
      minutes: meeting.minutes,
      minutesUpdatedAt: meeting.minutesUpdatedAt,
    };
  }

  async updateMinutes(id: string, userId: string, role: string, minutes: string) {
    const meeting = await this.platformPrisma.hamzoneMeeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.createdByUserId !== userId && !ADMIN_ROLES.includes(role)) {
      throw new ForbiddenException('Only the organizer or a platform admin can edit meeting minutes.');
    }
    return this.platformPrisma.hamzoneMeeting.update({
      where: { id },
      data: { minutes, minutesUpdatedAt: new Date(), minutesUpdatedByUserId: userId },
    });
  }
}
