import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { EMAIL_PROVIDER, EmailProvider } from '../email/email-provider.interface';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { renderMeetingMinutesPdf } from './meeting-minutes-pdf.util';

const ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'];
const ABSENCE_FOLLOWUP_EXPIRY_SEC = 30 * 60;

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
    private readonly platformSettings: PlatformSettingsService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
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

  private canManageAny(role: string, moduleGrants?: string[]): boolean {
    return ADMIN_ROLES.includes(role) || !!moduleGrants?.includes('MEETINGS');
  }

  /** {email, phone, name, position} for every resolved invitee — union of role match, team-tag
   * overlap, specific PlatformUser invites, and external contacts. `position` is PlatformUser.jobTitle
   * for a system account or HamzoneExternalContact.position for an outside guest — shown wherever an
   * attendee roster is displayed, so invitees know who else to expect. Accepts either the create DTO
   * (at creation time) or the persisted meeting row itself (for attendance/join lookups afterward) —
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
            select: { email: true, phone: true, fullName: true, jobTitle: true },
          })
        : Promise.resolve([]),
      selector.externalContactIds?.length
        ? this.platformPrisma.hamzoneExternalContact.findMany({
            where: { id: { in: selector.externalContactIds } },
            select: { email: true, phone: true, name: true, position: true },
          })
        : Promise.resolve([]),
    ]);
    return [
      ...users.map((u) => ({ email: u.email, phone: u.phone, name: u.fullName, position: u.jobTitle })),
      ...externalContacts.map((c) => ({ email: c.email, phone: c.phone, name: c.name, position: c.position })),
    ];
  }

  private agendaListText(agenda: string[]): string {
    return agenda.length ? agenda.map((item, i) => `${i + 1}. ${item}`).join('\n') : 'No agenda items listed.';
  }

  private rosterListText(recipients: { name: string | null; position: string | null }[]): string {
    if (recipients.length === 0) return 'No other invitees listed.';
    return recipients.map((r) => `- ${r.name ?? 'Unnamed'}${r.position ? ` (${r.position})` : ''}`).join('\n');
  }

  /** Signed at send time — one shared token per meeting (not per invitee), so every invite email
   * carries the same link differing only by the ?email= query param the recipient's own address is
   * pre-filled into. Expires 24h after the meeting by default so late joiners can still be marked
   * present; `endMeeting` re-signs a fresh, short-lived token for the post-meeting follow-up round
   * (the original may have already expired by the time the host ends the meeting). */
  private async signJoinToken(meetingId: string, scheduledAt: Date, minExpirySec = 60 * 60): Promise<string> {
    const expiresInSec = Math.max(Math.floor((scheduledAt.getTime() + 24 * 60 * 60 * 1000 - Date.now()) / 1000), minExpirySec);
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
      // Each invitee sees everyone *else* on the roster, not themselves — "who to expect."
      const rosterList = this.rosterListText(recipients.filter((x) => x !== r));
      const joinUrl = token && r.email ? `${webOrigin}/meetings/join/${token}?email=${encodeURIComponent(r.email)}` : (meeting.meetingLink ?? 'Details in-app');
      await this.notifier.notify('MEETING_INVITE', {
        to: { email: r.email, phone: r.phone },
        vars: {
          title: meeting.title,
          scheduledAt: scheduledLabel,
          meetingLink: meeting.meetingLink ?? 'Details in-app',
          organizerName: meeting.createdBy.fullName,
          agendaList,
          rosterList,
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
   * without requiring login; `invitedEmailMatched`/`alreadyJoined`/`alreadyRespondedAbsence` only
   * resolve once an email is supplied (pre-filled from the link's own query param, editable on the
   * page). `ended` tells the frontend whether to show the pre-meeting join flow or the post-meeting
   * confirm-presence/give-a-reason flow; `hasStarted` gates the join button itself — the link only
   * becomes functional once the scheduled time actually arrives, so "clicking early" can't count as
   * attending. `roster` lists everyone else invited (name + position, never email) so a visitor knows
   * who to expect. */
  async getJoinInfo(token: string, email?: string) {
    const meetingId = await this.verifyJoinToken(token);
    const meeting = await this.platformPrisma.hamzoneMeeting.findUnique({
      where: { id: meetingId },
      include: { createdBy: { select: { fullName: true } } },
    });
    if (!meeting) throw new NotFoundException('This meeting no longer exists.');

    const recipients = await this.resolveRecipients(meeting);
    const normalizedEmail = email?.trim().toLowerCase();
    let invitedEmailMatched = false;
    let alreadyJoined = false;
    let alreadyRespondedAbsence = false;
    if (normalizedEmail) {
      const [existing, existingAbsence] = await Promise.all([
        this.platformPrisma.hamzoneMeetingAttendance.findUnique({ where: { meetingId_email: { meetingId, email: normalizedEmail } } }),
        this.platformPrisma.hamzoneMeetingAbsenceReason.findUnique({ where: { meetingId_email: { meetingId, email: normalizedEmail } } }),
      ]);
      invitedEmailMatched = recipients.some((r) => r.email?.toLowerCase() === normalizedEmail);
      alreadyJoined = !!existing;
      alreadyRespondedAbsence = !!existingAbsence;
    }

    return {
      title: meeting.title,
      description: meeting.description,
      agenda: meeting.agenda,
      scheduledAt: meeting.scheduledAt,
      meetingLink: meeting.meetingLink,
      organizerName: meeting.createdBy.fullName,
      ended: !!meeting.endedAt,
      hasStarted: Date.now() >= meeting.scheduledAt.getTime(),
      roster: recipients.filter((r) => r.email?.toLowerCase() !== normalizedEmail).map((r) => ({ name: r.name, position: r.position })),
      invitedEmailMatched,
      alreadyJoined,
      alreadyRespondedAbsence,
    };
  }

  /** Public — records the join. Refuses before the meeting's scheduled start (the link only becomes
   * functional once the actual time arrives, so opening it early can't count as attending). Matching
   * is best-effort (case-insensitive email compare against the resolved audience) and never blocks
   * the visitor from reaching the meeting link either way — an unmatched join still opens the door,
   * it's just excluded from the official present/absent tally (see attendanceSummary). `ipAddress`/
   * `userAgent` are the best verification signal available without a video-conferencing webhook
   * integration — proof *a* browser at this address submitted this email at this time. */
  async recordJoin(token: string, email: string, name: string | undefined, ipAddress?: string, userAgent?: string) {
    const meetingId = await this.verifyJoinToken(token);
    const meeting = await this.platformPrisma.hamzoneMeeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('This meeting no longer exists.');
    if (Date.now() < meeting.scheduledAt.getTime()) {
      throw new BadRequestException(
        `This meeting hasn't started yet — the link becomes active at ${meeting.scheduledAt.toLocaleString('en-KE')}.`,
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new BadRequestException('Enter the email address you were invited with.');

    const recipients = await this.resolveRecipients(meeting);
    const matched = recipients.find((r) => r.email?.toLowerCase() === normalizedEmail);

    await this.platformPrisma.hamzoneMeetingAttendance.upsert({
      where: { meetingId_email: { meetingId, email: normalizedEmail } },
      create: { meetingId, email: normalizedEmail, name: matched?.name ?? name, matched: !!matched, ipAddress, userAgent },
      update: { name: matched?.name ?? name, matched: !!matched, ipAddress, userAgent },
    });

    return { joined: true, matched: !!matched, meetingLink: meeting.meetingLink };
  }

  /** Shared by attendanceSummary (read-only view) and endMeeting (which acts on the same split) —
   * present/absent is always computed at read time against the currently-resolved audience rather
   * than snapshotted, so editing who's invited after the fact never leaves stale rows behind. */
  private async computePresentAbsent(meeting: { id: string } & AudienceSelector) {
    const [recipients, records] = await Promise.all([
      this.resolveRecipients(meeting),
      this.platformPrisma.hamzoneMeetingAttendance.findMany({ where: { meetingId: meeting.id }, orderBy: { joinedAt: 'asc' } }),
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
      .map((r) => ({ email: r.email!, name: r.name, joinedAt: records.find((rec) => rec.email === r.email!.toLowerCase())?.joinedAt }));
    const absent = invitedUnique
      .filter((r) => !presentEmails.has(r.email!.toLowerCase()))
      .map((r) => ({ email: r.email!, name: r.name, phone: r.phone }));
    const extraJoins = records
      .filter((r) => !r.matched)
      .map((r) => ({ email: r.email, name: r.name, joinedAt: r.joinedAt }));

    return { invitedUnique, present, absent, extraJoins };
  }

  async attendanceSummary(id: string) {
    const meeting = await this.platformPrisma.hamzoneMeeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const { invitedUnique, present, absent, extraJoins } = await this.computePresentAbsent(meeting);

    return {
      totalInvited: invitedUnique.length,
      totalPresent: present.length,
      totalAbsent: absent.length,
      present,
      absent,
      extraJoins,
      minutes: meeting.minutes,
      minutesUpdatedAt: meeting.minutesUpdatedAt,
      endedAt: meeting.endedAt,
    };
  }

  /** The host (or anyone with SUPER_ADMIN/SUB_ADMIN/ASSISTANT_SUPER_ADMIN tier, or a specific MEETINGS
   * module grant — see PlatformAdminModuleGrant) clicking "End meeting": a one-time action that sends
   * a thank-you to everyone recorded present and a 30-minute-window absence-followup (re-confirm
   * presence or give a reason) to everyone recorded absent, per the currently-resolved audience.
   * Idempotency guard: this can't be re-run for the same meeting, since re-sending would spam
   * everyone a second time. */
  async endMeeting(id: string, userId: string, role: string, moduleGrants?: string[]) {
    const meeting = await this.platformPrisma.hamzoneMeeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.createdByUserId !== userId && !this.canManageAny(role, moduleGrants)) {
      throw new ForbiddenException('Only the organizer or a platform admin can end this meeting.');
    }
    if (meeting.endedAt) throw new BadRequestException('This meeting has already been ended — notices were already sent.');

    const { present, absent } = await this.computePresentAbsent(meeting);
    const scheduledLabel = meeting.scheduledAt.toLocaleString('en-KE');

    await this.platformPrisma.hamzoneMeeting.update({ where: { id }, data: { endedAt: new Date(), endedByUserId: userId } });

    for (const p of present) {
      await this.notifier.notify('MEETING_THANK_YOU', {
        to: { email: p.email },
        vars: { title: meeting.title, scheduledAt: scheduledLabel },
      });
    }

    if (absent.length > 0) {
      // Re-signed here (not reusing the original invite token) since the meeting may have ended long
      // after the original 24h-post-scheduledAt window — this one gets a tight 30-minute window,
      // matching how urgently minutes need to close out who was actually there.
      const followupToken = await this.signJoinToken(meeting.id, meeting.scheduledAt, ABSENCE_FOLLOWUP_EXPIRY_SEC);
      const webOrigin = this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
      for (const a of absent) {
        const joinUrl = `${webOrigin}/meetings/join/${followupToken}?email=${encodeURIComponent(a.email)}`;
        await this.notifier.notify('MEETING_ABSENT_FOLLOWUP', {
          to: { email: a.email, phone: a.phone },
          vars: { title: meeting.title, scheduledAt: scheduledLabel, joinUrl },
        });
      }
    }

    return { ended: true, presentNotified: present.length, absentNotified: absent.length };
  }

  /** Public — the "I wasn't able to attend" branch of the post-meeting follow-up. Refuses to
   * overwrite someone who's actually already marked present (they'd have no reason to explain).
   * `ipAddress`/`userAgent` are recorded on the reason too, same verification-signal reasoning as
   * recordJoin. */
  async submitAbsenceReason(token: string, email: string, reason: string, ipAddress?: string, userAgent?: string) {
    const meetingId = await this.verifyJoinToken(token);
    const meeting = await this.platformPrisma.hamzoneMeeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('This meeting no longer exists.');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new BadRequestException('Enter your email address.');
    if (!reason.trim()) throw new BadRequestException('Please give a short reason.');

    const existing = await this.platformPrisma.hamzoneMeetingAttendance.findUnique({
      where: { meetingId_email: { meetingId, email: normalizedEmail } },
    });
    if (existing?.matched) {
      throw new BadRequestException('You are already marked present for this meeting — no reason needed.');
    }

    await this.platformPrisma.hamzoneMeetingAbsenceReason.upsert({
      where: { meetingId_email: { meetingId, email: normalizedEmail } },
      create: { meetingId, email: normalizedEmail, reason: reason.trim(), ipAddress, userAgent },
      update: { reason: reason.trim(), ipAddress, userAgent },
    });
    return { saved: true };
  }

  async updateMinutes(id: string, userId: string, role: string, minutes: string, moduleGrants?: string[]) {
    const meeting = await this.platformPrisma.hamzoneMeeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.createdByUserId !== userId && !this.canManageAny(role, moduleGrants)) {
      throw new ForbiddenException('Only the organizer or a platform admin can edit meeting minutes.');
    }
    return this.platformPrisma.hamzoneMeeting.update({
      where: { id },
      data: { minutes, minutesUpdatedAt: new Date(), minutesUpdatedByUserId: userId },
    });
  }

  private async buildMinutesPdf(id: string) {
    const meeting = await this.platformPrisma.hamzoneMeeting.findUnique({
      where: { id },
      include: { createdBy: { select: { fullName: true } }, minutesUpdatedBy: { select: { fullName: true } } },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const [{ present, absent }, settings] = await Promise.all([this.computePresentAbsent(meeting), this.platformSettings.get()]);

    return renderMeetingMinutesPdf({
      logoUrl: settings.loginLogoUrl,
      title: meeting.title,
      description: meeting.description,
      agenda: meeting.agenda,
      scheduledAt: meeting.scheduledAt,
      organizerName: meeting.createdBy.fullName,
      present: present.map((p) => ({ name: p.name, email: p.email })),
      absent: absent.map((a) => ({ name: a.name, email: a.email })),
      minutes: meeting.minutes,
      minutesUpdatedByName: meeting.minutesUpdatedBy?.fullName ?? null,
      minutesUpdatedAt: meeting.minutesUpdatedAt,
      generatedAt: new Date(),
    });
  }

  async downloadMinutesPdf(id: string) {
    const meeting = await this.platformPrisma.hamzoneMeeting.findUnique({ where: { id }, select: { title: true } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    const pdf = await this.buildMinutesPdf(id);
    return { pdf, filename: `${meeting.title.replace(/[^a-z0-9]+/gi, '-')}-minutes.pdf` };
  }

  /** Emails the minutes PDF either to a specific PlatformUser (by id) or an arbitrary external email
   * address — best-effort, never throws on delivery failure (the PDF itself is still downloadable
   * either way). */
  async shareMinutes(id: string, userId: string, role: string, toUserId: string | undefined, toEmail: string | undefined, moduleGrants?: string[]) {
    const meeting = await this.platformPrisma.hamzoneMeeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.createdByUserId !== userId && !this.canManageAny(role, moduleGrants)) {
      throw new ForbiddenException('Only the organizer or a platform admin can share meeting minutes.');
    }

    let recipientEmail = toEmail?.trim();
    if (toUserId) {
      const target = await this.platformPrisma.platformUser.findUnique({ where: { id: toUserId }, select: { email: true } });
      if (!target) throw new NotFoundException('That person was not found in the system.');
      recipientEmail = target.email;
    }
    if (!recipientEmail) throw new BadRequestException('Choose a person from the system or enter an email address.');

    const pdf = await this.buildMinutesPdf(id);
    const result = await this.emailProvider.send(
      recipientEmail,
      `Meeting minutes — ${meeting.title}`,
      `Attached are the minutes for "${meeting.title}" (${meeting.scheduledAt.toLocaleString('en-KE')}).`,
      [{ filename: `${meeting.title.replace(/[^a-z0-9]+/gi, '-')}-minutes.pdf`, content: pdf, contentType: 'application/pdf' }],
    );
    return { sent: result.success, to: recipientEmail };
  }
}
