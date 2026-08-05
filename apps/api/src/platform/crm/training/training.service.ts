import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../../../common/prisma/platform-prisma.service';
import { UpsertTrainingDto } from './dto/upsert-training.dto';

/** Who has trained with Hamzone (DTP frontend/backend, Coding & Robotics) — see HamzoneTrainingRecord's
 * schema doc comment. Read-only listing is also exposed to third parties via the API-key-guarded
 * public endpoints (HamzoneApiKeyGuard) so the company website can show real program activity. */
@Injectable()
export class HamzoneTrainingService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  async list(page = 1, pageSize = 30, track?: string, status?: string) {
    const where = { ...(track ? { track: track as never } : {}), ...(status ? { status: status as never } : {}) };
    const [data, total] = await Promise.all([
      this.platformPrisma.hamzoneTrainingRecord.findMany({
        where,
        include: { client: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.platformPrisma.hamzoneTrainingRecord.count({ where }),
    ]);
    return { data, meta: { page, pageSize, total } };
  }

  create(dto: UpsertTrainingDto, userId: string) {
    if (!dto.traineeName || !dto.track) {
      throw new BadRequestException('traineeName and track are required');
    }
    return this.platformPrisma.hamzoneTrainingRecord.create({
      data: {
        clientId: dto.clientId,
        traineeName: dto.traineeName,
        traineeEmail: dto.traineeEmail,
        traineePhone: dto.traineePhone,
        track: dto.track,
        trackOther: dto.trackOther,
        status: dto.status,
        notes: dto.notes,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
        completedAt: dto.completedAt ? new Date(dto.completedAt) : undefined,
        createdByUserId: userId,
      },
    });
  }

  async update(id: string, dto: UpsertTrainingDto) {
    const existing = await this.platformPrisma.hamzoneTrainingRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Training record not found');
    return this.platformPrisma.hamzoneTrainingRecord.update({
      where: { id },
      data: {
        ...dto,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
        completedAt: dto.completedAt ? new Date(dto.completedAt) : undefined,
      },
    });
  }

  /** Aggregate counts by track/status — the "training we have done" summary a third party (or the
   * public API) can show without dumping every trainee's PII. */
  async overview() {
    const [byTrack, byStatus, total] = await Promise.all([
      this.platformPrisma.hamzoneTrainingRecord.groupBy({ by: ['track'], _count: true }),
      this.platformPrisma.hamzoneTrainingRecord.groupBy({ by: ['status'], _count: true }),
      this.platformPrisma.hamzoneTrainingRecord.count(),
    ]);
    return {
      total,
      byTrack: byTrack.map((t) => ({ track: t.track, count: t._count })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    };
  }
}
