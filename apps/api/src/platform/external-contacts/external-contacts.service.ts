import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { CreateExternalContactDto } from './dto/create-external-contact.dto';

/**
 * A shared address book for people outside the platform — never a PlatformUser account, no role,
 * no login. Backs the "schedule/campaign with someone not in the database" flow on both Meetings
 * and Campaigns: add one from either place and it's reusable from the other, instead of retyping
 * the same name/phone/email every time. Always surfaced in the UI labeled "External contact — not
 * in the system," so it's never mistaken for a real account.
 */
@Injectable()
export class ExternalContactsService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  list(q?: string) {
    return this.platformPrisma.hamzoneExternalContact.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
    });
  }

  /** Dedupes by matching email or phone against an existing row — the same external person added
   * a second time (from a different meeting/campaign, possibly by a different admin) reuses their
   * existing contact instead of spawning a duplicate. */
  async findOrCreate(dto: CreateExternalContactDto, userId: string) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('An external contact needs at least an email or phone number');
    }
    const existing = await this.platformPrisma.hamzoneExternalContact.findFirst({
      where: {
        OR: [...(dto.email ? [{ email: dto.email }] : []), ...(dto.phone ? [{ phone: dto.phone }] : [])],
      },
    });
    if (existing) return existing;

    return this.platformPrisma.hamzoneExternalContact.create({
      data: { name: dto.name, email: dto.email, phone: dto.phone, notes: dto.notes, createdByUserId: userId },
    });
  }

  async remove(id: string) {
    const existing = await this.platformPrisma.hamzoneExternalContact.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contact not found');
    return this.platformPrisma.hamzoneExternalContact.delete({ where: { id } });
  }
}
