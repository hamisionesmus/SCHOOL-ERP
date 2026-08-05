import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

  // Upsert on (programId, date) — matches the new unique constraint added for the daily-link
  // system, so a trainer re-submitting the same day's form (here or via the link) updates the same
  // row instead of erroring or duplicating.
  create(dto: CreateRegisterDto, trainerId: string) {
    const date = new Date(dto.date);
    return this.platformPrisma.hamzoneDailyRegister.upsert({
      where: { programId_date: { programId: dto.programId, date } },
      create: { ...dto, date, trainerId, hadTrainingToday: true },
      update: { ...dto, date, trainerId, hadTrainingToday: true },
      include: REGISTER_INCLUDE,
    });
  }

  // "The trainer has a place to see charts and graphs... present and absent, male and female — but
  // he cannot track payments, that's for the super admin." No financial data anywhere in this
  // method. restrictToTrainerId, when passed, 403s a trainer trying to view another trainer's
  // program stats by guessing a programId — see HamzoneRegistersController.stats().
  async stats(programId: string, restrictToTrainerId?: string) {
    const program = await this.platformPrisma.hamzoneTrainingProgram.findUnique({
      where: { id: programId },
      select: { id: true, title: true, startDate: true, endDate: true, trainerId: true },
    });
    if (!program) throw new NotFoundException('Program not found');
    if (restrictToTrainerId && program.trainerId !== restrictToTrainerId) {
      throw new ForbiddenException('You can only view stats for your own programs');
    }

    const [registers, rosterSize] = await Promise.all([
      this.platformPrisma.hamzoneDailyRegister.findMany({
        where: { programId },
        include: { attendance: { include: { trainee: { select: { gender: true } } } } },
        orderBy: { date: 'asc' },
      }),
      this.platformPrisma.hamzoneTrainee.count({ where: { programId } }),
    ]);

    const byGender: Record<'MALE' | 'FEMALE' | 'OTHER', { present: number; absent: number }> = {
      MALE: { present: 0, absent: 0 },
      FEMALE: { present: 0, absent: 0 },
      OTHER: { present: 0, absent: 0 },
    };
    const dailyTrend = registers.map((r) => {
      let present = 0;
      let absent = 0;
      for (const a of r.attendance) {
        const bucket = byGender[a.trainee.gender];
        if (a.present) {
          present++;
          bucket.present++;
        } else {
          absent++;
          bucket.absent++;
        }
      }
      return { date: r.date, present, absent, hadTrainingToday: r.hadTrainingToday };
    });

    const totalPresent = dailyTrend.reduce((sum, d) => sum + d.present, 0);
    const totalAbsent = dailyTrend.reduce((sum, d) => sum + d.absent, 0);
    const totalMarks = totalPresent + totalAbsent;
    const daysRemaining = Math.max(0, Math.ceil((program.endDate.getTime() - Date.now()) / 86_400_000));

    return {
      programTitle: program.title,
      startDate: program.startDate,
      endDate: program.endDate,
      daysRemaining,
      rosterSize,
      totalPresent,
      totalAbsent,
      attendanceRate: totalMarks > 0 ? Math.round((totalPresent / totalMarks) * 100) : null,
      byGender,
      dailyTrend,
    };
  }

  /** Named present/absent trainees for one register — "not just the present number and absent
   * number... the actual names are very important." Kept as its own lightweight call (rather than
   * bloating list()/findOne() for every row in the admin table) since it's only fetched when a row
   * is expanded. */
  async attendanceDetail(id: string, restrictToTrainerId?: string) {
    const register = await this.platformPrisma.hamzoneDailyRegister.findUnique({
      where: { id },
      include: {
        attendance: {
          include: { trainee: { select: { id: true, fullName: true, gender: true, age: true, educationLevel: true } } },
          orderBy: { trainee: { fullName: 'asc' } },
        },
      },
    });
    if (!register) throw new NotFoundException('Register not found');
    if (restrictToTrainerId && register.trainerId !== restrictToTrainerId) {
      throw new ForbiddenException('You can only view attendance for your own registers');
    }
    const present = register.attendance.filter((a) => a.present).map((a) => a.trainee);
    const absent = register.attendance.filter((a) => !a.present).map((a) => a.trainee);
    return { date: register.date, present, absent };
  }

  async pdf(id: string) {
    const register = await this.findOne(id);
    const buffer = await renderDailyRegisterPdf({
      programTitle: register.program.title,
      trainerName: register.trainer.user.fullName,
      centerName: register.program.center?.name ?? null,
      date: register.date,
      hadTrainingToday: register.hadTrainingToday,
      noTrainingReason: register.noTrainingReason,
      traineesPresent: register.traineesPresent,
      traineesTotal: register.traineesTotal,
      topicsCovered: register.topicsCovered,
      notes: register.notes,
      generatedAt: new Date(),
    });
    return { buffer, filename: `register-${register.date.toISOString().slice(0, 10)}.pdf` };
  }
}
