import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { UserDirectoryService } from '../../common/user-directory/user-directory.service';
import { generateTempPassword } from '../../common/password.util';
import { UpsertOutreachEntryDto } from './dto/upsert-outreach-entry.dto';
import { CreateEarningDto } from './dto/create-earning.dto';
import { CreateGigWorkerDto } from './dto/create-gig-worker.dto';

const ENTRY_INCLUDE = {
  createdBy: { select: { fullName: true } },
  assignedTo: { select: { id: true, fullName: true, email: true, phone: true } },
  earnings: { orderBy: { periodDate: 'desc' as const } },
} as const;

/**
 * A personal outreach/gig-management log — explicitly NOT Hamzone company business. See
 * HamzoneOutreachEntry's schema doc comment. Strictly scoped: an entry is only ever visible to the
 * admin who created it and whoever it's assigned to (if that's a real PlatformUser) — never
 * platform-wide, not even to other Super Admins, since this is framed as a personal record.
 */
@Injectable()
export class HamzoneOutreachService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly notifier: PlatformNotifierService,
    private readonly userDirectory: UserDirectoryService,
  ) {}

  list(userId: string) {
    return this.platformPrisma.hamzoneOutreachEntry.findMany({
      where: { OR: [{ createdByUserId: userId }, { assignedToUserId: userId }] },
      include: ENTRY_INCLUDE,
      orderBy: { receivedAt: 'desc' },
    });
  }

  private async findAccessible(id: string, userId: string) {
    const entry = await this.platformPrisma.hamzoneOutreachEntry.findUnique({ where: { id }, include: ENTRY_INCLUDE });
    if (!entry) throw new NotFoundException('Entry not found');
    if (entry.createdByUserId !== userId && entry.assignedToUserId !== userId) {
      throw new BadRequestException('This entry is not yours');
    }
    return entry;
  }

  findOne(id: string, userId: string) {
    return this.findAccessible(id, userId);
  }

  create(dto: UpsertOutreachEntryDto, userId: string) {
    return this.platformPrisma.hamzoneOutreachEntry.create({
      data: { ...dto, receivedAt: new Date(dto.receivedAt), createdByUserId: userId },
      include: ENTRY_INCLUDE,
    });
  }

  /** Only the creator can edit the entry's own details — the assignee's only write access is
   * logging their own earnings/challenges (see addEarning below), not rewriting who the contact is. */
  async update(id: string, dto: UpsertOutreachEntryDto, userId: string) {
    const entry = await this.platformPrisma.hamzoneOutreachEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Entry not found');
    if (entry.createdByUserId !== userId) throw new BadRequestException('Only the person who logged this entry can edit it');
    return this.platformPrisma.hamzoneOutreachEntry.update({
      where: { id },
      data: { ...dto, receivedAt: new Date(dto.receivedAt) },
      include: ENTRY_INCLUDE,
    });
  }

  async addEarning(entryId: string, dto: CreateEarningDto, userId: string) {
    await this.findAccessible(entryId, userId);
    return this.platformPrisma.hamzoneOutreachEarning.create({
      data: { ...dto, periodDate: new Date(dto.periodDate), entryId, recordedByUserId: userId },
    });
  }

  /** Creates a GIG_WORKER-role login account so the Super Admin can assign an outreach entry to
   * someone and have them report their own earnings/challenges back in — see the PlatformRole
   * schema doc comment for why this is a distinct, narrowly-scoped role. */
  async createWorker(dto: CreateGigWorkerDto, requestedByUserId: string) {
    await this.userDirectory.assertEmailNotInUse(dto.email);
    const inviter = await this.platformPrisma.platformUser.findUnique({ where: { id: requestedByUserId } });
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const worker = await this.platformPrisma.platformUser.create({
      data: { email: dto.email, fullName: dto.fullName, phone: dto.phone, passwordHash, role: 'GIG_WORKER' },
      select: { id: true, email: true, fullName: true, phone: true, role: true, createdAt: true },
    });

    const loginUrl = `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/login`;
    await this.notifier.notify('GIG_WORKER_WELCOME', {
      to: { email: dto.email, phone: dto.phone },
      vars: { fullName: dto.fullName, loginUrl, email: dto.email, tempPassword, invitedByName: inviter?.fullName ?? 'Hamzone Technologies' },
    });

    return worker;
  }

  listWorkers() {
    return this.platformPrisma.platformUser.findMany({
      where: { role: 'GIG_WORKER' },
      select: { id: true, fullName: true, email: true, phone: true, deletedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
