import { Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../../../common/prisma/platform-prisma.service';
import { UpsertProgramDto } from './dto/upsert-program.dto';

const PROGRAM_INCLUDE = {
  center: { select: { id: true, name: true } },
  trainer: { include: { user: { select: { fullName: true } } } },
  _count: { select: { trainees: true, registers: true } },
} as const;

/** A cohort/course run with real start/end dates — see HamzoneTrainingProgram's schema doc comment. */
@Injectable()
export class HamzoneProgramsService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  list() {
    return this.platformPrisma.hamzoneTrainingProgram.findMany({
      include: PROGRAM_INCLUDE,
      orderBy: { startDate: 'desc' },
    });
  }

  async listForTrainerProfile(trainerId: string) {
    return this.platformPrisma.hamzoneTrainingProgram.findMany({
      where: { trainerId },
      include: PROGRAM_INCLUDE,
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(id: string) {
    const program = await this.platformPrisma.hamzoneTrainingProgram.findUnique({
      where: { id },
      include: { ...PROGRAM_INCLUDE, resources: { orderBy: { createdAt: 'desc' } } },
    });
    if (!program) throw new NotFoundException('Training program not found');
    return program;
  }

  create(dto: UpsertProgramDto, userId: string) {
    return this.platformPrisma.hamzoneTrainingProgram.create({
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        plannedProjectDueAt: dto.plannedProjectDueAt ? new Date(dto.plannedProjectDueAt) : undefined,
        createdByUserId: userId,
      },
      include: PROGRAM_INCLUDE,
    });
  }

  async update(id: string, dto: UpsertProgramDto) {
    await this.findOne(id);
    return this.platformPrisma.hamzoneTrainingProgram.update({
      where: { id },
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        plannedProjectDueAt: dto.plannedProjectDueAt ? new Date(dto.plannedProjectDueAt) : undefined,
      },
      include: PROGRAM_INCLUDE,
    });
  }
}
