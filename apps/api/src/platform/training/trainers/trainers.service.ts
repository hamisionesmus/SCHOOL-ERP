import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PlatformPrismaService } from '../../../common/prisma/platform-prisma.service';
import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import { PlatformNotifierService } from '../../messaging/platform-notifier.service';
import { UserDirectoryService } from '../../../common/user-directory/user-directory.service';
import { generateTempPassword } from '../../../common/password.util';
import { renderTrainerContractPdf } from './trainer-contract-pdf.util';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { UpdateTrainerProfileDto } from './dto/update-trainer-profile.dto';

const PROFILE_INCLUDE = {
  user: { select: { id: true, fullName: true, email: true, phone: true } },
  center: { select: { id: true, name: true } },
} as const;

/** Trainer employment records — who they are (a TRAINER-role PlatformUser), where they're assigned,
 * what they're paid, and their contract window. See HamzoneTrainerProfile's schema doc comment. */
@Injectable()
export class HamzoneTrainersService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly settings: PlatformSettingsService,
    private readonly notifier: PlatformNotifierService,
    private readonly userDirectory: UserDirectoryService,
  ) {}

  list() {
    return this.platformPrisma.hamzoneTrainerProfile.findMany({
      include: PROFILE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const profile = await this.platformPrisma.hamzoneTrainerProfile.findUnique({
      where: { id },
      include: PROFILE_INCLUDE,
    });
    if (!profile) throw new NotFoundException('Trainer not found');
    return profile;
  }

  async findByUserId(userId: string) {
    const profile = await this.platformPrisma.hamzoneTrainerProfile.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    });
    if (!profile) throw new NotFoundException('No trainer profile found for this account');
    return profile;
  }

  /** Creates the TRAINER-role login account and its profile in one step, then emails/SMSes the
   * temp password — same "invite" shape as PlatformAdminsService.confirmCreate(), but without the
   * OTP gate, since a trainer account is a much lower blast-radius grant than a Sub-Admin/Assistant
   * Super Admin one. */
  async create(dto: CreateTrainerDto, requestedByUserId: string) {
    await this.userDirectory.assertEmailNotInUse(dto.email);
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await this.platformPrisma.platformUser.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        phone: dto.phone,
        address: dto.address,
        passwordHash,
        role: 'TRAINER',
        defaultRole: 'TRAINER',
        mustChangePassword: true,
      },
    });
    const profile = await this.platformPrisma.hamzoneTrainerProfile.create({
      data: {
        userId: user.id,
        centerId: dto.centerId,
        track: dto.track,
        trackOther: dto.track === 'OTHER' ? dto.trackOther : undefined,
        monthlySalaryKes: dto.monthlySalaryKes,
        contractStartDate: dto.contractStartDate ? new Date(dto.contractStartDate) : undefined,
        contractEndDate: dto.contractEndDate ? new Date(dto.contractEndDate) : undefined,
      },
      include: PROFILE_INCLUDE,
    });

    // Opens the first center-history row so "assigned to 5+ centers consecutively" has a starting
    // point from day one, not just from whenever the center is first changed later.
    if (dto.centerId) {
      await this.platformPrisma.hamzoneTrainerCenterHistory.create({
        data: { trainerId: profile.id, centerId: dto.centerId },
      });
    }

    const center = dto.centerId ? await this.platformPrisma.hamzoneTrainingCenter.findUnique({ where: { id: dto.centerId } }) : null;
    const loginUrl = `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/login`;
    await this.notifier.notify('TRAINER_WELCOME', {
      to: { email: dto.email, phone: dto.phone },
      vars: {
        fullName: dto.fullName,
        loginUrl,
        email: dto.email,
        tempPassword,
        centerName: center ? ` at ${center.name}` : '',
        track: dto.track ? ` (${dto.track.replace(/_/g, ' ').toLowerCase()})` : '',
      },
    });

    return profile;
  }

  /** When centerId actually changes, closes out whatever center-history row is still open (endDate
   * null) and opens a fresh one for the new center — this is what makes "assigned to 5+ centers
   * consecutively" a real, queryable history rather than just the current centerId overwriting
   * itself silently each time. */
  async updateProfile(id: string, dto: UpdateTrainerProfileDto) {
    const existing = await this.findOne(id);
    const centerChanging = dto.centerId !== undefined && dto.centerId !== existing.center?.id;

    if (centerChanging) {
      await this.platformPrisma.hamzoneTrainerCenterHistory.updateMany({
        where: { trainerId: id, endDate: null },
        data: { endDate: new Date() },
      });
      if (dto.centerId) {
        await this.platformPrisma.hamzoneTrainerCenterHistory.create({
          data: { trainerId: id, centerId: dto.centerId },
        });
      }
    }

    return this.platformPrisma.hamzoneTrainerProfile.update({
      where: { id },
      data: {
        ...dto,
        trackOther: dto.track === 'OTHER' ? dto.trackOther : dto.track ? null : undefined,
        contractStartDate: dto.contractStartDate ? new Date(dto.contractStartDate) : undefined,
        contractEndDate: dto.contractEndDate ? new Date(dto.contractEndDate) : undefined,
      },
      include: PROFILE_INCLUDE,
    });
  }

  centerHistory(id: string) {
    return this.platformPrisma.hamzoneTrainerCenterHistory.findMany({
      where: { trainerId: id },
      include: { center: { select: { id: true, name: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  /** Builds the contract PDF fresh from whatever's currently stored — "auto-generated" means
   * derived automatically from the profile's own fields on every download, not a one-time snapshot
   * that could drift out of sync if salary/dates change later. */
  async contractPdf(id: string) {
    const profile = await this.findOne(id);
    const settings = await this.settings.get();
    const buffer = await renderTrainerContractPdf({
      logoUrl: settings.loginLogoUrl,
      trainerName: profile.user.fullName,
      trainerEmail: profile.user.email,
      trainerPhone: profile.user.phone,
      track: profile.track,
      centerName: profile.center?.name ?? null,
      monthlySalaryKes: profile.monthlySalaryKes,
      contractStartDate: profile.contractStartDate,
      contractEndDate: profile.contractEndDate,
      generatedAt: new Date(),
    });
    return { buffer, filename: `${profile.user.fullName.replace(/\s+/g, '-')}-contract.pdf` };
  }

  async assertOwnsProfile(profileId: string, userId: string) {
    const profile = await this.platformPrisma.hamzoneTrainerProfile.findUnique({ where: { id: profileId } });
    if (!profile || profile.userId !== userId) {
      throw new BadRequestException('This is not your trainer profile');
    }
    return profile;
  }
}
