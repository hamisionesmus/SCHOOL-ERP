import { Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../../../common/prisma/platform-prisma.service';
import { UpsertCenterDto } from './dto/upsert-center.dto';

/** A physical or virtual training venue — "this center has been assigned this person" (headUser)
 * and "the number of students" from the original request. Distinct from a School-ERP Tenant. */
@Injectable()
export class HamzoneCentersService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  list() {
    return this.platformPrisma.hamzoneTrainingCenter.findMany({
      include: {
        headUser: { select: { fullName: true } },
        _count: { select: { programs: true, trainerProfiles: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const center = await this.platformPrisma.hamzoneTrainingCenter.findUnique({
      where: { id },
      include: {
        headUser: { select: { fullName: true } },
        programs: { orderBy: { startDate: 'desc' } },
        trainerProfiles: { include: { user: { select: { fullName: true, email: true, phone: true } } } },
      },
    });
    if (!center) throw new NotFoundException('Training center not found');
    return center;
  }

  create(dto: UpsertCenterDto, userId: string) {
    return this.platformPrisma.hamzoneTrainingCenter.create({ data: { ...dto, createdByUserId: userId } });
  }

  async update(id: string, dto: UpsertCenterDto) {
    await this.findOne(id);
    return this.platformPrisma.hamzoneTrainingCenter.update({ where: { id }, data: dto });
  }
}
