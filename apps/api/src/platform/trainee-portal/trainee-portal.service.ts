import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { generateTempPassword } from '../../common/password.util';
import { GrantPortalAccessDto } from './dto/grant-portal-access.dto';

/**
 * A deliberately small self-service surface for trainees — "some trainees will have access to a
 * portal or profile to see progress and all the learning material, especially those 20+" — so an
 * adult learner can check their own attendance % and the shared resources for their program without
 * needing a full platform account. Read-only: a trainee can never edit their own roster row,
 * attendance, or anything else here.
 */
@Injectable()
export class TraineePortalService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly notifier: PlatformNotifierService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Admin/trainer action — turns on portal access for one trainee, generating credentials and
   * sending them the same way any other system-generated-password account is welcomed. */
  async grantAccess(traineeId: string, dto: GrantPortalAccessDto) {
    const trainee = await this.platformPrisma.hamzoneTrainee.findUnique({
      where: { id: traineeId },
      include: { program: { select: { title: true } } },
    });
    if (!trainee) throw new NotFoundException('Trainee not found');

    const existing = await this.platformPrisma.hamzoneTrainee.findUnique({ where: { portalEmail: dto.portalEmail } });
    if (existing && existing.id !== traineeId) {
      throw new BadRequestException('That email is already used for another trainee\'s portal login');
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    await this.platformPrisma.hamzoneTrainee.update({
      where: { id: traineeId },
      data: { portalEmail: dto.portalEmail, portalPasswordHash: passwordHash, portalEnabled: true },
    });

    const loginUrl = `${this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000'}/trainee-portal`;
    await this.notifier.notify('TRAINEE_PORTAL_WELCOME', {
      to: { email: dto.portalEmail, phone: trainee.phone },
      vars: {
        fullName: trainee.fullName,
        programTitle: trainee.program.title,
        loginUrl,
        email: dto.portalEmail,
        tempPassword,
      },
    });

    return { granted: true };
  }

  async revokeAccess(traineeId: string) {
    await this.platformPrisma.hamzoneTrainee.update({
      where: { id: traineeId },
      data: { portalEnabled: false },
    });
    return { revoked: true };
  }

  async login(email: string, password: string) {
    const trainee = await this.platformPrisma.hamzoneTrainee.findUnique({ where: { portalEmail: email } });
    if (!trainee || !trainee.portalEnabled || !trainee.portalPasswordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!(await bcrypt.compare(password, trainee.portalPasswordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const accessToken = await this.jwt.signAsync(
      { purpose: 'trainee-portal', traineeId: trainee.id },
      { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '14d' },
    );
    return { accessToken, trainee: { id: trainee.id, fullName: trainee.fullName } };
  }

  async getMe(traineeId: string) {
    const trainee = await this.platformPrisma.hamzoneTrainee.findUnique({
      where: { id: traineeId },
      select: {
        id: true,
        fullName: true,
        gender: true,
        portalEmail: true,
        program: { select: { id: true, title: true, track: true, startDate: true, endDate: true, status: true } },
      },
    });
    if (!trainee) throw new NotFoundException('Trainee not found');
    return trainee;
  }

  /** Own attendance history + a simple present/total percentage — no financial data anywhere in
   * this module, matching the same trainer-facing boundary (trainees see even less than trainers). */
  async getProgress(traineeId: string) {
    const records = await this.platformPrisma.hamzoneAttendanceRecord.findMany({
      where: { traineeId },
      include: { register: { select: { date: true, topicsCovered: true, hadTrainingToday: true } } },
      orderBy: { register: { date: 'desc' } },
    });
    const total = records.length;
    const present = records.filter((r) => r.present).length;
    return {
      totalSessions: total,
      present,
      absent: total - present,
      attendancePct: total > 0 ? Math.round((present / total) * 100) : null,
      history: records.map((r) => ({
        date: r.register.date,
        present: r.present,
        topicsCovered: r.register.topicsCovered,
        hadTrainingToday: r.register.hadTrainingToday,
      })),
    };
  }

  /** Shared documents for the trainee's own program, plus general (no-program) resources — the
   * exact same visibility boundary a TRAINER gets in HamzoneDocumentsService.list(), so a trainee
   * never sees the whole company's document library either. */
  async getMaterials(traineeId: string) {
    const trainee = await this.platformPrisma.hamzoneTrainee.findUnique({ where: { id: traineeId } });
    if (!trainee) throw new NotFoundException('Trainee not found');
    return this.platformPrisma.hamzoneDocument.findMany({
      where: { OR: [{ trainingProgramId: null }, { trainingProgramId: trainee.programId }] },
      select: { id: true, title: true, category: true, fileUrl: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
