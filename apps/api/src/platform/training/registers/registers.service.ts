import { Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../../../common/prisma/platform-prisma.service';
import { renderDailyRegisterPdf } from './daily-register-pdf.util';
import { CreateRegisterDto } from './dto/create-register.dto';

const REGISTER_INCLUDE = {
  program: { select: { title: true, center: { select: { name: true } } } },
  trainer: { include: { user: { select: { fullName: true } } } },
} as const;

/** A trainer's daily attendance + coverage log — see HamzoneDailyRegister's schema doc comment. */
@Injectable()
export class HamzoneRegistersService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  list(programId?: string, trainerId?: string) {
    return this.platformPrisma.hamzoneDailyRegister.findMany({
      where: { ...(programId ? { programId } : {}), ...(trainerId ? { trainerId } : {}) },
      include: REGISTER_INCLUDE,
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string) {
    const register = await this.platformPrisma.hamzoneDailyRegister.findUnique({ where: { id }, include: REGISTER_INCLUDE });
    if (!register) throw new NotFoundException('Register not found');
    return register;
  }

  create(dto: CreateRegisterDto, trainerId: string) {
    return this.platformPrisma.hamzoneDailyRegister.create({
      data: { ...dto, date: new Date(dto.date), trainerId },
      include: REGISTER_INCLUDE,
    });
  }

  async pdf(id: string) {
    const register = await this.findOne(id);
    const buffer = await renderDailyRegisterPdf({
      programTitle: register.program.title,
      trainerName: register.trainer.user.fullName,
      centerName: register.program.center?.name ?? null,
      date: register.date,
      traineesPresent: register.traineesPresent,
      traineesTotal: register.traineesTotal,
      topicsCovered: register.topicsCovered,
      notes: register.notes,
      generatedAt: new Date(),
    });
    return { buffer, filename: `register-${register.date.toISOString().slice(0, 10)}.pdf` };
  }
}
