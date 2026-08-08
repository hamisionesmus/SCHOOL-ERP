import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { generateTempPassword } from '../../common/password.util';
import { GrantPortalAccessDto } from './dto/grant-portal-access.dto';
import { buildWorkbook, ExcelColumn } from '../../common/excel/excel-builder.util';
import { parseWorkbook, RowError } from '../../common/excel/excel-parser.util';
import { TRAINEE_IMPORT_INSTRUCTIONS } from './trainees-import-instructions';
import { generateTraineeNumber } from '../training/trainees/trainee-number.util';

const TRAINEE_GENDERS = ['MALE', 'FEMALE', 'OTHER'];

interface TraineeExportRow {
  traineeNumber: string | null;
  fullName: string;
  gender: string;
  phone: string | null;
  address: string | null;
  age: number | null;
  educationLevel: string | null;
  program: { title: string };
}

/**
 * A deliberately small self-service surface for trainees — "some trainees will have access to a
 * portal or profile to see progress and all the learning material, especially those 20+" — so an
 * adult learner can check their own attendance % and the shared resources for their program without
 * needing a full platform account. Read-only: a trainee can never edit their own roster row,
 * attendance, or anything else here.
 */
@Injectable()
export class TraineePortalService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly notifier: PlatformNotifierService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Admin/trainer action — turns on portal access for one trainee, generating credentials and
   * sending them the same way any other system-generated-password account is welcomed. */
  async grantAccess(traineeId: string, dto: GrantPortalAccessDto) {
    const trainee = await this.platformPrisma.hamzoneTrainee.findUnique({
      where: { id: traineeId },
      include: { program: { select: { title: true } } },
    });
    if (!trainee) throw new NotFoundException('Trainee not found');

    const existing = await this.platformPrisma.hamzoneTrainee.findUnique({ where: { portalEmail: dto.portalEmail } });
    if (existing && existing.id !== traineeId) {
      throw new BadRequestException('That email is already used for another trainee\'s portal login');
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    await this.platformPrisma.hamzoneTrainee.update({
      where: { id: traineeId },
      data: { portalEmail: dto.portalEmail, portalPasswordHash: passwordHash, portalEnabled: true },
    });

    const loginUrl = `${this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000'}/trainee-portal`;
    await this.notifier.notify('TRAINEE_PORTAL_WELCOME', {
      to: { email: dto.portalEmail, phone: trainee.phone },
      vars: {
        fullName: trainee.fullName,
        programTitle: trainee.program.title,
        loginUrl,
        email: dto.portalEmail,
        tempPassword,
      },
    });

    return { granted: true };
  }

  async revokeAccess(traineeId: string) {
    await this.platformPrisma.hamzoneTrainee.update({
      where: { id: traineeId },
      data: { portalEnabled: false },
    });
    return { revoked: true };
  }

  async login(email: string, password: string) {
    const trainee = await this.platformPrisma.hamzoneTrainee.findUnique({ where: { portalEmail: email } });
    if (!trainee || !trainee.portalEnabled || !trainee.portalPasswordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!(await bcrypt.compare(password, trainee.portalPasswordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const accessToken = await this.jwt.signAsync(
      { purpose: 'trainee-portal', traineeId: trainee.id },
      { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '14d' },
    );
    return { accessToken, trainee: { id: trainee.id, fullName: trainee.fullName } };
  }

  async getMe(traineeId: string) {
    const trainee = await this.platformPrisma.hamzoneTrainee.findUnique({
      where: { id: traineeId },
      select: {
        id: true,
        fullName: true,
        gender: true,
        portalEmail: true,
        program: { select: { id: true, title: true, track: true, startDate: true, endDate: true, status: true } },
      },
    });
    if (!trainee) throw new NotFoundException('Trainee not found');
    return trainee;
  }

  /** Shared by the trainee's own getProgress() and the admin-side findOne() — same present/total
   * math, same history shape, so the two views can never disagree with each other. */
  private async attendanceSummary(traineeId: string) {
    const records = await this.platformPrisma.hamzoneAttendanceRecord.findMany({
      where: { traineeId },
      include: { register: { select: { date: true, topicsCovered: true, hadTrainingToday: true } } },
      orderBy: { register: { date: 'desc' } },
    });
    const total = records.length;
    const present = records.filter((r) => r.present).length;
    return {
      totalSessions: total,
      present,
      absent: total - present,
      attendancePct: total > 0 ? Math.round((present / total) * 100) : null,
      history: records.map((r) => ({
        date: r.register.date,
        present: r.present,
        topicsCovered: r.register.topicsCovered,
        hadTrainingToday: r.register.hadTrainingToday,
      })),
    };
  }

  /** Own attendance history + a simple present/total percentage — no financial data anywhere in
   * this module, matching the same trainer-facing boundary (trainees see even less than trainers). */
  async getProgress(traineeId: string) {
    return this.attendanceSummary(traineeId);
  }

  // ---- Admin-side list/detail — see docs plan "C: Trainee list/detail pages" ----

  async adminList(programId?: string) {
    return this.platformPrisma.hamzoneTrainee.findMany({
      where: programId ? { programId } : undefined,
      include: { program: { select: { id: true, title: true, track: true, status: true } } },
      orderBy: { fullName: 'asc' },
    });
  }

  async adminFindOne(id: string) {
    const trainee = await this.platformPrisma.hamzoneTrainee.findUnique({
      where: { id },
      select: {
        id: true,
        traineeNumber: true,
        fullName: true,
        gender: true,
        phone: true,
        address: true,
        age: true,
        educationLevel: true,
        portalEmail: true,
        portalEnabled: true,
        createdAt: true,
        program: { select: { id: true, title: true, track: true, status: true, startDate: true, endDate: true } },
      },
    });
    if (!trainee) throw new NotFoundException('Trainee not found');
    const attendance = await this.attendanceSummary(id);
    return { ...trainee, attendance };
  }

  /** Shared documents for the trainee's own program, plus general (no-program) resources — the
   * exact same visibility boundary a TRAINER gets in HamzoneDocumentsService.list(), so a trainee
   * never sees the whole company's document library either. */
  async getMaterials(traineeId: string) {
    const trainee = await this.platformPrisma.hamzoneTrainee.findUnique({ where: { id: traineeId } });
    if (!trainee) throw new NotFoundException('Trainee not found');
    return this.platformPrisma.hamzoneDocument.findMany({
      where: { OR: [{ trainingProgramId: null }, { trainingProgramId: trainee.programId }] },
      select: { id: true, title: true, category: true, fileUrl: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---- Excel import/export — see docs/IMPORT_EXPORT.md ----

  private traineeColumns(programTitles: string[]): ExcelColumn<TraineeExportRow>[] {
    return [
      { header: 'Trainee Number', key: 'traineeNumber', getValue: (r) => r.traineeNumber },
      { header: 'Full Name', key: 'fullName', required: true, getValue: (r) => r.fullName },
      { header: 'Gender', key: 'gender', required: true, dropdown: TRAINEE_GENDERS, getValue: (r) => r.gender },
      {
        header: 'Program Title',
        key: 'programTitle',
        required: true,
        dropdown: programTitles,
        getValue: (r) => r.program.title,
      },
      { header: 'Phone', key: 'phone', getValue: (r) => r.phone },
      { header: 'Address', key: 'address', getValue: (r) => r.address },
      { header: 'Age', key: 'age', getValue: (r) => r.age },
      { header: 'Education Level', key: 'educationLevel', getValue: (r) => r.educationLevel },
    ];
  }

  async exportExcel(): Promise<Buffer> {
    const [trainees, programs] = await Promise.all([
      this.platformPrisma.hamzoneTrainee.findMany({
        include: { program: { select: { title: true } } },
        orderBy: { fullName: 'asc' },
      }),
      this.platformPrisma.hamzoneTrainingProgram.findMany({ select: { title: true } }),
    ]);
    return buildWorkbook({
      sheetName: 'Trainees',
      columns: this.traineeColumns(programs.map((p) => p.title)),
      rows: trainees,
    });
  }

  async importTemplateExcel(): Promise<Buffer> {
    const programs = await this.platformPrisma.hamzoneTrainingProgram.findMany({ select: { title: true } });
    return buildWorkbook({
      sheetName: 'Trainees',
      columns: this.traineeColumns(programs.map((p) => p.title)),
      rows: [],
      instructions: TRAINEE_IMPORT_INSTRUCTIONS,
    });
  }

  async importFromExcel(buffer: Buffer) {
    const programs = await this.platformPrisma.hamzoneTrainingProgram.findMany({ select: { id: true, title: true } });
    const columns = this.traineeColumns(programs.map((p) => p.title));
    const { rows, headerErrors } = await parseWorkbook(buffer, columns.map((c) => ({ header: c.header, key: c.key })));
    if (headerErrors.length > 0) return { created: 0, updated: 0, errors: headerErrors };

    const errors: RowError[] = [];
    const seenKeys = new Map<string, number[]>();
    for (const row of rows) {
      const key = String(row.data.traineeNumber ?? '').trim();
      if (!key) continue;
      seenKeys.set(key, [...(seenKeys.get(key) ?? []), row.rowNumber]);
    }
    for (const [key, rowNumbers] of seenKeys) {
      if (rowNumbers.length > 1) {
        for (const rn of rowNumbers) {
          errors.push({ row: rn, field: 'traineeNumber', message: `Trainee number ${key} appears on rows ${rowNumbers.join(', ')} — fix duplicates before importing.` });
        }
      }
    }

    const programByTitle = new Map(programs.map((p) => [p.title, p]));

    type Planned = { row: number; isUpdate: boolean; existingId?: string; data: Record<string, unknown> };
    const planned: Planned[] = [];

    for (const row of rows) {
      const traineeNumber = String(row.data.traineeNumber ?? '').trim();
      if ((seenKeys.get(traineeNumber)?.length ?? 0) > 1) continue; // already flagged as duplicate

      const existing = traineeNumber
        ? await this.platformPrisma.hamzoneTrainee.findUnique({ where: { traineeNumber } })
        : null;
      if (traineeNumber && !existing) {
        errors.push({ row: row.rowNumber, field: 'traineeNumber', message: `No existing trainee with trainee number ${traineeNumber} — leave blank to create a new trainee instead.` });
        continue;
      }

      const fullName = String(row.data.fullName ?? '').trim();
      const genderRaw = String(row.data.gender ?? '').trim().toUpperCase();
      const programTitleRaw = String(row.data.programTitle ?? '').trim();

      if (!existing && !fullName) {
        errors.push({ row: row.rowNumber, field: 'fullName', message: 'Full Name is required for a new trainee.' });
      }

      let gender: string | undefined;
      if (genderRaw) {
        if (!TRAINEE_GENDERS.includes(genderRaw)) {
          errors.push({ row: row.rowNumber, field: 'gender', message: `Gender must be one of ${TRAINEE_GENDERS.join(', ')}, got "${genderRaw}".` });
        } else {
          gender = genderRaw;
        }
      } else if (!existing) {
        errors.push({ row: row.rowNumber, field: 'gender', message: 'Gender is required for a new trainee.' });
      }

      let programId: string | undefined;
      if (programTitleRaw) {
        const program = programByTitle.get(programTitleRaw);
        if (!program) {
          errors.push({ row: row.rowNumber, field: 'programTitle', message: `No training program titled "${programTitleRaw}" — valid titles: ${[...programByTitle.keys()].join(', ')}.` });
        } else {
          programId = program.id;
        }
      } else if (!existing) {
        errors.push({ row: row.rowNumber, field: 'programTitle', message: 'Program Title is required for a new trainee.' });
      }

      const ageRaw = row.data.age;
      let age: number | undefined;
      if (ageRaw !== null && ageRaw !== undefined && ageRaw !== '') {
        const parsed = Number(ageRaw);
        if (isNaN(parsed) || parsed <= 0) {
          errors.push({ row: row.rowNumber, field: 'age', message: `Age must be a positive number, got "${ageRaw}".` });
        } else {
          age = parsed;
        }
      }

      planned.push({
        row: row.rowNumber,
        isUpdate: !!existing,
        existingId: existing?.id,
        data: {
          ...(fullName ? { fullName } : {}),
          ...(gender ? { gender } : {}),
          ...(programId ? { programId } : {}),
          ...(row.data.phone ? { phone: String(row.data.phone) } : {}),
          ...(row.data.address ? { address: String(row.data.address) } : {}),
          ...(age !== undefined ? { age } : {}),
          ...(row.data.educationLevel ? { educationLevel: String(row.data.educationLevel) } : {}),
        },
      });
    }

    if (errors.length > 0) return { created: 0, updated: 0, errors };

    let created = 0;
    let updated = 0;
    await this.platformPrisma.$transaction(async (tx) => {
      for (const p of planned) {
        if (p.isUpdate && p.existingId) {
          await tx.hamzoneTrainee.update({ where: { id: p.existingId }, data: p.data });
          updated++;
        } else {
          await tx.hamzoneTrainee.create({
            data: {
              traineeNumber: await generateTraineeNumber(tx as never),
              fullName: p.data.fullName as string,
              gender: p.data.gender as never,
              programId: p.data.programId as string,
              phone: p.data.phone as string | undefined,
              address: p.data.address as string | undefined,
              age: p.data.age as number | undefined,
              educationLevel: p.data.educationLevel as string | undefined,
            },
          });
          created++;
        }
      }
    });

    return { created, updated, errors: [] };
  }
}
