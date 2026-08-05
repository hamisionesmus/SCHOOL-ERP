import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { PlatformPrismaService } from '../../../common/prisma/platform-prisma.service';
import { PlatformNotifierService } from '../../messaging/platform-notifier.service';
import { SubmitDailyRegisterDto } from './dto/submit-daily-register.dto';

interface DailyLinkTokenPayload {
  purpose: 'daily-link';
  programId: string;
  trainerId: string;
  date: string; // YYYY-MM-DD — the one calendar day this link is valid for
}

const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Backs the daily magic link every active trainer gets by SMS/email each training day — "one link
 * for a day... does not allow multiple submissions after a day the link expires." Identity and
 * day-scoping are both carried entirely in the signed token (mirrors ActivationService's pattern),
 * so a trainer never has to log in just to mark a register. Re-opening the same day's link before
 * midnight is deliberately still editable (see submitRegister's upsert) — only a *new* calendar day
 * requires a fresh link.
 */
@Injectable()
export class DailyLinkService {
  private readonly logger = new Logger('DailyLink');

  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifier: PlatformNotifierService,
  ) {}

  private todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async signLinkToken(programId: string, trainerId: string, date = this.todayKey()): Promise<string> {
    const payload: DailyLinkTokenPayload = { purpose: 'daily-link', programId, trainerId, date };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '2d',
    });
  }

  private async verifyToken(token: string): Promise<DailyLinkTokenPayload> {
    let decoded: DailyLinkTokenPayload;
    try {
      decoded = await this.jwt.verifyAsync<DailyLinkTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new BadRequestException('This link is invalid or has expired.');
    }
    if (decoded.purpose !== 'daily-link') throw new BadRequestException('This link is invalid.');
    if (decoded.date !== this.todayKey()) {
      throw new BadRequestException(
        'This link was for a previous training day and has expired. A new one is generated and sent automatically each training day.',
      );
    }
    return decoded;
  }

  async getInfo(token: string) {
    const { programId, trainerId, date } = await this.verifyToken(token);
    const [program, trainer, roster, register] = await Promise.all([
      this.platformPrisma.hamzoneTrainingProgram.findUnique({
        where: { id: programId },
        select: { id: true, title: true, center: { select: { name: true } } },
      }),
      this.platformPrisma.hamzoneTrainerProfile.findUnique({
        where: { id: trainerId },
        include: { user: { select: { fullName: true } } },
      }),
      this.platformPrisma.hamzoneTrainee.findMany({
        where: { programId },
        select: { id: true, fullName: true, gender: true, phone: true, address: true, age: true },
        orderBy: { fullName: 'asc' },
      }),
      this.platformPrisma.hamzoneDailyRegister.findUnique({
        where: { programId_date: { programId, date: new Date(date) } },
        include: { attendance: true },
      }),
    ]);
    if (!program || !trainer) throw new NotFoundException('This link no longer points to a valid program or trainer.');

    return {
      programTitle: program.title,
      centerName: program.center?.name ?? null,
      trainerName: trainer.user.fullName,
      date,
      isFirstTime: roster.length === 0,
      roster,
      alreadySubmitted: !!register,
      hadTrainingToday: register?.hadTrainingToday ?? null,
      noTrainingReason: register?.noTrainingReason ?? null,
      topicsCovered: register?.topicsCovered ?? null,
      notes: register?.notes ?? null,
      attendance: register?.attendance.map((a) => ({ traineeId: a.traineeId, present: a.present })) ?? [],
      photo1Url: register?.photo1Url ?? null,
      photo2Url: register?.photo2Url ?? null,
    };
  }

  async submitNoTraining(token: string, reason: string) {
    const { programId, trainerId, date } = await this.verifyToken(token);
    const registerDate = new Date(date);
    await this.platformPrisma.hamzoneDailyRegister.upsert({
      where: { programId_date: { programId, date: registerDate } },
      create: { programId, trainerId, date: registerDate, hadTrainingToday: false, noTrainingReason: reason, traineesTotal: 0 },
      update: { hadTrainingToday: false, noTrainingReason: reason, traineesPresent: 0 },
    });
    return { saved: true };
  }

  async submitRegister(token: string, dto: SubmitDailyRegisterDto) {
    const { programId, trainerId, date } = await this.verifyToken(token);
    const registerDate = new Date(date);

    // Resolve each entry to a real HamzoneTrainee row — first-time names create the roster row,
    // returning names just get their attendance updated. "The very first time... names are required
    // for verification" — every entry always carries a fullName, never a bare headcount.
    const traineeIds: string[] = [];
    for (const entry of dto.trainees) {
      let traineeId: string | undefined;
      if (entry.id) {
        const existing = await this.platformPrisma.hamzoneTrainee.findFirst({ where: { id: entry.id, programId } });
        if (existing) traineeId = existing.id;
      }
      if (!traineeId) {
        const created = await this.platformPrisma.hamzoneTrainee.create({
          data: {
            programId,
            fullName: entry.fullName,
            gender: entry.gender,
            phone: entry.phone,
            address: entry.address,
            age: entry.age,
          },
        });
        traineeId = created.id;
      }
      traineeIds.push(traineeId);
    }

    const presentCount = dto.trainees.filter((t) => t.present).length;

    const register = await this.platformPrisma.hamzoneDailyRegister.upsert({
      where: { programId_date: { programId, date: registerDate } },
      create: {
        programId,
        trainerId,
        date: registerDate,
        hadTrainingToday: true,
        traineesPresent: presentCount,
        traineesTotal: dto.trainees.length,
        topicsCovered: dto.topicsCovered,
        notes: dto.notes,
      },
      update: {
        hadTrainingToday: true,
        noTrainingReason: null,
        traineesPresent: presentCount,
        traineesTotal: dto.trainees.length,
        topicsCovered: dto.topicsCovered,
        notes: dto.notes,
      },
    });

    // Resubmitting within the same day can drop a name that was added by mistake — remove any
    // attendance rows for trainees no longer in this submission, then upsert the rest.
    await this.platformPrisma.hamzoneAttendanceRecord.deleteMany({
      where: { registerId: register.id, traineeId: { notIn: traineeIds } },
    });
    await Promise.all(
      dto.trainees.map((entry, i) =>
        this.platformPrisma.hamzoneAttendanceRecord.upsert({
          where: { registerId_traineeId: { registerId: register.id, traineeId: traineeIds[i] } },
          create: { registerId: register.id, traineeId: traineeIds[i], present: entry.present },
          update: { present: entry.present },
        }),
      ),
    );

    return { saved: true, registerId: register.id };
  }

  /** Exactly two proof-of-attendance photos per day, enforced by the fixed slot param (1 or 2) —
   * uploading again to the same slot replaces it, matching the "editable within the day" rule. */
  async savePhoto(token: string, slot: 1 | 2, file: Express.Multer.File): Promise<{ url: string }> {
    const { programId, trainerId, date } = await this.verifyToken(token);
    const ext = extname(file.originalname).toLowerCase();
    if (!PHOTO_EXTENSIONS.has(ext)) throw new BadRequestException('Only JPG, JPEG, PNG, or WEBP photos are allowed');
    if (file.size > PHOTO_MAX_BYTES) throw new BadRequestException('Photo must be under 8MB');

    const dir = join(process.cwd(), 'uploads', 'daily-registers');
    mkdirSync(dir, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    writeFileSync(join(dir, filename), file.buffer);
    const url = `/uploads/daily-registers/${filename}`;

    const registerDate = new Date(date);
    const field = slot === 1 ? 'photo1Url' : 'photo2Url';
    await this.platformPrisma.hamzoneDailyRegister.upsert({
      where: { programId_date: { programId, date: registerDate } },
      create: { programId, trainerId, date: registerDate, hadTrainingToday: true, [field]: url },
      update: { [field]: url },
    });
    return { url };
  }

  private async sendLinkFor(
    program: { id: string; title: string },
    trainer: { id: string; user: { fullName: string; email: string; phone: string | null } },
  ) {
    const token = await this.signLinkToken(program.id, trainer.id);
    const link = `${this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000'}/daily-link/${token}`;
    await this.notifier.notify('DAILY_TRAINING_LINK', {
      to: { email: trainer.user.email, phone: trainer.user.phone },
      vars: { fullName: trainer.user.fullName, programTitle: program.title, date: this.todayKey(), link },
    });
  }

  /** Trainer-initiated resend, for when today's automatic message didn't arrive — scoped to the
   * trainer's own currently-active program(s) only, resolved from their own JWT identity. */
  async resendMyLinks(userId: string) {
    const trainer = await this.platformPrisma.hamzoneTrainerProfile.findUnique({
      where: { userId },
      include: { user: { select: { fullName: true, email: true, phone: true } } },
    });
    if (!trainer) throw new NotFoundException('Trainer profile not found');

    const today = new Date();
    const programs = await this.platformPrisma.hamzoneTrainingProgram.findMany({
      where: { trainerId: trainer.id, status: 'ACTIVE', startDate: { lte: today }, endDate: { gte: today } },
    });
    if (programs.length === 0) {
      throw new BadRequestException('No active training program found for today under your profile.');
    }
    for (const program of programs) {
      await this.sendLinkFor(program, trainer);
    }
    return { sent: programs.length };
  }

  /** The daily auto-send — "always automatically generated and sent to the phone number and email
   * every day of the training until the training is over." Runs early morning so the link is ready
   * before the training day starts; failures for one program never block the rest. */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async sendDailyLinksToAll() {
    const today = new Date();
    const programs = await this.platformPrisma.hamzoneTrainingProgram.findMany({
      where: { status: 'ACTIVE', trainerId: { not: null }, startDate: { lte: today }, endDate: { gte: today } },
      include: { trainer: { include: { user: { select: { fullName: true, email: true, phone: true } } } } },
    });
    let sent = 0;
    for (const program of programs) {
      if (!program.trainer) continue;
      try {
        await this.sendLinkFor(program, program.trainer);
        sent++;
      } catch (err) {
        this.logger.error(`Failed to send daily link for program ${program.id}: ${err instanceof Error ? err.message : err}`);
      }
    }
    return { sent };
  }
}
