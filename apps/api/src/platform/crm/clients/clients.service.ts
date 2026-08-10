import { NotFoundException, Injectable } from '@nestjs/common';
import { PlatformPrismaService } from '../../../common/prisma/platform-prisma.service';
import { UpsertClientDto } from './dto/upsert-client.dto';
import { CreateClientNoteDto } from './dto/create-client-note.dto';

/**
 * Hamzone Technologies' own client roster — separate from schools' subscription relationship with
 * the ERP (see HamzoneClient's schema doc comment). A client optionally links to a Tenant when
 * they're also a School-ERP subscriber, so the CRM's "total clients" figure never double-counts them.
 */
@Injectable()
export class HamzoneClientsService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  async list(page = 1, pageSize = 30, q?: string, stage?: string) {
    const where = {
      ...(q
        ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { email: { contains: q, mode: 'insensitive' as const } }, { phone: { contains: q } }] }
        : {}),
      ...(stage ? { stage: stage as never } : {}),
    };
    const [data, total] = await Promise.all([
      this.platformPrisma.hamzoneClient.findMany({
        where,
        include: { tenant: { select: { name: true } }, _count: { select: { invoices: true, notes: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.platformPrisma.hamzoneClient.count({ where }),
    ]);
    return { data, meta: { page, pageSize, total } };
  }

  async findOne(id: string) {
    const client = await this.platformPrisma.hamzoneClient.findUnique({
      where: { id },
      include: {
        tenant: { select: { name: true, slug: true } },
        createdBy: { select: { fullName: true } },
        notes: { include: { author: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } },
        invoices: { orderBy: { createdAt: 'desc' } },
        trainingRecords: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  create(dto: UpsertClientDto, userId: string) {
    return this.platformPrisma.hamzoneClient.create({
      data: { ...dto, createdByUserId: userId },
    });
  }

  async update(id: string, dto: UpsertClientDto) {
    await this.findOne(id);
    return this.platformPrisma.hamzoneClient.update({ where: { id }, data: dto });
  }

  async addNote(clientId: string, dto: CreateClientNoteDto, authorUserId: string) {
    await this.findOne(clientId);
    return this.platformPrisma.hamzoneClientNote.create({
      data: { clientId, body: dto.body, authorUserId },
      include: { author: { select: { fullName: true } } },
    });
  }

  /** Total distinct Hamzone clients across every product line — the headline "how many clients do
   * we have" figure, used both on the CRM overview and exposed read-only via the public API key
   * endpoints for the company website. */
  count() {
    return this.platformPrisma.hamzoneClient.count();
  }
}
