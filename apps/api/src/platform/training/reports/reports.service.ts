import { Injectable } from '@nestjs/common';
import { PlatformPrismaService } from '../../../common/prisma/platform-prisma.service';
import { CreateTrainerReportDto } from './dto/create-report.dto';

const REPORT_INCLUDE = {
  trainer: { include: { user: { select: { fullName: true } } } },
  program: { select: { title: true } },
} as const;

/** A trainer's periodic progress/challenges check-in — see HamzoneTrainerReport's schema doc
 * comment. This is the "are they actually working" signal alongside daily registers. */
@Injectable()
export class HamzoneTrainerReportsService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  list(trainerId?: string) {
    return this.platformPrisma.hamzoneTrainerReport.findMany({
      where: trainerId ? { trainerId } : {},
      include: REPORT_INCLUDE,
      orderBy: { periodStart: 'desc' },
    });
  }

  create(dto: CreateTrainerReportDto, trainerId: string) {
    return this.platformPrisma.hamzoneTrainerReport.create({
      data: { ...dto, periodStart: new Date(dto.periodStart), periodEnd: new Date(dto.periodEnd), trainerId },
      include: REPORT_INCLUDE,
    });
  }
}
