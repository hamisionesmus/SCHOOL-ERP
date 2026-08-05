import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../../../common/prisma/platform-prisma.service';
import { UpsertLeadDto } from './dto/upsert-lead.dto';

/** Real-time field submissions from the marketing team (every platform admin tier plus anyone
 * invited specifically for marketing — see HamzoneMarketingLead's schema doc comment). Submitted
 * the moment a lead is captured, not batched at day's end, so follow-ups don't go cold. */
@Injectable()
export class HamzoneLeadsService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  async list(page = 1, pageSize = 30, status?: string) {
    const where = status ? { status: status as never } : {};
    const [data, total] = await Promise.all([
      this.platformPrisma.hamzoneMarketingLead.findMany({
        where,
        include: { submittedBy: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.platformPrisma.hamzoneMarketingLead.count({ where }),
    ]);
    return { data, meta: { page, pageSize, total } };
  }

  create(dto: UpsertLeadDto, submittedByUserId: string) {
    if (!dto.clientName || !dto.interest) {
      throw new BadRequestException('clientName and interest are required');
    }
    return this.platformPrisma.hamzoneMarketingLead.create({
      data: {
        clientName: dto.clientName,
        interest: dto.interest,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        location: dto.location,
        notes: dto.notes,
        followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : undefined,
        submittedByUserId,
      },
    });
  }

  async update(id: string, dto: UpsertLeadDto) {
    const existing = await this.platformPrisma.hamzoneMarketingLead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead not found');
    return this.platformPrisma.hamzoneMarketingLead.update({
      where: { id },
      data: { ...dto, followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : undefined },
    });
  }
}
