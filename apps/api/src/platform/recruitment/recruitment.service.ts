import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import * as bcrypt from 'bcryptjs';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { UserDirectoryService } from '../../common/user-directory/user-directory.service';
import { generateTempPassword } from '../../common/password.util';
import { UpsertPositionDto } from './dto/upsert-position.dto';
import { PublicSubmitApplicationDto } from './dto/public-submit-application.dto';
import { ScheduleInterviewDto } from './dto/schedule-interview.dto';
import { RejectApplicationDto } from './dto/reject-application.dto';
import { HireApplicationDto } from './dto/hire-application.dto';

const CERT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']);
const CERT_MAX_BYTES = 8 * 1024 * 1024; // 8MB

/**
 * Vacancy positions Super Admin opens, and the applicants who apply through the public API (see
 * PublicRecruitmentController). Two independent numbers per position, per explicit instruction:
 * `requiredPositions` (how many the company intends to hire) and `maxApplicants` (a cap on total
 * applications before the public link self-closes as "at capacity") — never assumed equal.
 */
@Injectable()
export class RecruitmentService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly notifier: PlatformNotifierService,
    private readonly userDirectory: UserDirectoryService,
  ) {}

  // ---- Positions (admin-managed) ----

  listPositions() {
    return this.platformPrisma.hamzoneJobPosition.findMany({
      include: { _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPosition(id: string) {
    const position = await this.platformPrisma.hamzoneJobPosition.findUnique({
      where: { id },
      include: { applications: { orderBy: { createdAt: 'desc' } } },
    });
    if (!position) throw new NotFoundException('Position not found');
    return position;
  }

  createPosition(dto: UpsertPositionDto, createdByUserId: string) {
    return this.platformPrisma.hamzoneJobPosition.create({
      data: {
        title: dto.title,
        roleType: dto.roleType,
        roleTypeOther: dto.roleType === 'STAFF' ? dto.roleTypeOther : undefined,
        description: dto.description,
        requiredPositions: dto.requiredPositions,
        maxApplicants: dto.maxApplicants,
        closesAt: dto.closesAt ? new Date(dto.closesAt) : undefined,
        createdByUserId,
      },
    });
  }

  async updatePosition(id: string, dto: Partial<UpsertPositionDto> & { status?: 'OPEN' | 'CLOSED' | 'FILLED' }) {
    await this.findPosition(id);
    return this.platformPrisma.hamzoneJobPosition.update({
      where: { id },
      data: {
        ...dto,
        roleTypeOther: dto.roleType === 'STAFF' ? dto.roleTypeOther : dto.roleType ? null : undefined,
        closesAt: dto.closesAt ? new Date(dto.closesAt) : undefined,
      },
    });
  }

  // ---- Public surface (no login — API key gated) ----

  /** Only OPEN positions with capacity remaining — what a careers page/Lovable site should list. */
  async listOpenPositions() {
    const positions = await this.platformPrisma.hamzoneJobPosition.findMany({
      where: { status: 'OPEN' },
      include: { _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return positions
      .filter((p) => p._count.applications < p.maxApplicants && (!p.closesAt || p.closesAt > new Date()))
      .map((p) => ({
        id: p.id,
        title: p.title,
        roleType: p.roleType,
        roleTypeOther: p.roleTypeOther,
        description: p.description,
        spotsRemaining: p.maxApplicants - p._count.applications,
        closesAt: p.closesAt,
      }));
  }

  /** Same "is this position even reachable" check the public list applies, used to gate a direct
   * apply attempt too — a position could fill up between the applicant loading the list and
   * submitting, so this is re-checked at submission time, not just trusted from the list call. */
  private async assertPositionAcceptingApplications(positionId: string) {
    const position = await this.platformPrisma.hamzoneJobPosition.findUnique({
      where: { id: positionId },
      include: { _count: { select: { applications: true } } },
    });
    if (!position) throw new NotFoundException('Position not found');
    if (position.status !== 'OPEN') {
      throw new BadRequestException('This position is no longer accepting applications.');
    }
    if (position.closesAt && position.closesAt <= new Date()) {
      throw new BadRequestException('This position is no longer accepting applications.');
    }
    if (position._count.applications >= position.maxApplicants) {
      // Auto-closes so the next list call reflects it immediately, without waiting for an admin.
      await this.platformPrisma.hamzoneJobPosition.update({ where: { id: positionId }, data: { status: 'CLOSED' } });
      throw new BadRequestException('This position has reached full capacity and is no longer accepting applications.');
    }
    return position;
  }

  async submitApplication(positionId: string, dto: PublicSubmitApplicationDto) {
    await this.assertPositionAcceptingApplications(positionId);
    return this.platformPrisma.hamzoneJobApplication.create({
      data: {
        positionId,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        experienceSummary: dto.experienceSummary,
        linkedinUrl: dto.linkedinUrl,
        githubUrl: dto.githubUrl,
        certificateUrls: dto.certificateUrls ?? [],
        coverNote: dto.coverNote,
      },
    });
  }

  /** Certificates (PDF/DOC/images) uploaded by an anonymous applicant — separate from the
   * JWT-gated UploadsService (which has no concept of an anonymous caller and only allows image
   * types). Stored under uploads/recruitment/, same local-disk pattern as everything else. */
  saveCertificate(file: Express.Multer.File): { url: string } {
    const ext = extname(file.originalname).toLowerCase();
    if (!CERT_EXTENSIONS.has(ext)) {
      throw new BadRequestException('Only PDF, DOC, DOCX, JPG, or PNG files are allowed for certificates');
    }
    if (file.size > CERT_MAX_BYTES) {
      throw new BadRequestException('File must be under 8MB');
    }
    const dir = join(process.cwd(), 'uploads', 'recruitment');
    mkdirSync(dir, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    writeFileSync(join(dir, filename), file.buffer);
    return { url: `/uploads/recruitment/${filename}` };
  }

  // ---- Application review (admin-managed) ----

  listApplications(positionId?: string, status?: string) {
    return this.platformPrisma.hamzoneJobApplication.findMany({
      where: { ...(positionId ? { positionId } : {}), ...(status ? { status: status as never } : {}) },
      include: { position: { select: { id: true, title: true, roleType: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findApplication(id: string) {
    const application = await this.platformPrisma.hamzoneJobApplication.findUnique({
      where: { id },
      include: { position: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  async scheduleInterview(id: string, dto: ScheduleInterviewDto) {
    const application = await this.findApplication(id);
    const updated = await this.platformPrisma.hamzoneJobApplication.update({
      where: { id },
      data: { status: 'INTERVIEW_SCHEDULED', interviewAt: new Date(dto.interviewAt), interviewNotes: dto.notes },
    });
    await this.notifier.notify('JOB_INTERVIEW_SCHEDULED', {
      to: { email: application.email, phone: application.phone },
      vars: {
        fullName: application.fullName,
        positionTitle: application.position.title,
        interviewAt: new Date(dto.interviewAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }),
        notes: dto.notes ?? '',
      },
    });
    return updated;
  }

  async rejectApplication(id: string, dto: RejectApplicationDto) {
    const application = await this.findApplication(id);
    const updated = await this.platformPrisma.hamzoneJobApplication.update({
      where: { id },
      data: { status: 'REJECTED', rejectedReason: dto.reason },
    });
    await this.notifier.notify('JOB_REJECTED', {
      to: { email: application.email, phone: application.phone },
      vars: { fullName: application.fullName, positionTitle: application.position.title },
    });
    return updated;
  }

  /** The successful path: creates the PlatformUser login (mustChangePassword: true, same gate as
   * every other system-generated-credential account), optionally an initial HamzoneStaffTask so
   * the hire knows where to start, sends the congratulations message with login details, and marks
   * the application HIRED. If the role is TRAINER, admins still complete a full trainer profile
   * (center/track/salary/contract) separately via the Training module — hiring here only creates
   * the login, since those fields aren't collected on a job application. */
  async hire(id: string, dto: HireApplicationDto) {
    const application = await this.findApplication(id);
    if (application.status === 'HIRED') throw new BadRequestException('This application has already been hired');
    await this.userDirectory.assertEmailNotInUse(application.email);

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const role = application.position.roleType;

    const user = await this.platformPrisma.platformUser.create({
      data: {
        email: application.email,
        fullName: application.fullName,
        phone: application.phone,
        address: application.address,
        jobTitle: role === 'STAFF' ? application.position.roleTypeOther : undefined,
        passwordHash,
        role,
        defaultRole: role,
        mustChangePassword: true,
      },
    });

    if (dto.taskTitle) {
      await this.platformPrisma.hamzoneStaffTask.create({
        data: {
          assignedToUserId: user.id,
          title: dto.taskTitle,
          description: dto.taskDescription,
          repoUrl: dto.taskRepoUrl,
          dueDate: dto.taskDueDate ? new Date(dto.taskDueDate) : undefined,
          assignedByUserId: application.position.createdByUserId,
        },
      });
    }

    await this.platformPrisma.hamzoneJobApplication.update({
      where: { id },
      data: { status: 'HIRED', hiredUserId: user.id },
    });

    // A position fills up independently of its applicant cap — once enough applicants are hired to
    // meet requiredPositions, mark it FILLED so it stops showing as an open opportunity.
    const hiredCount = await this.platformPrisma.hamzoneJobApplication.count({
      where: { positionId: application.positionId, status: 'HIRED' },
    });
    if (hiredCount >= application.position.requiredPositions) {
      await this.platformPrisma.hamzoneJobPosition.update({ where: { id: application.positionId }, data: { status: 'FILLED' } });
    }

    const loginUrl = `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/login`;
    await this.notifier.notify('JOB_HIRED', {
      to: { email: application.email, phone: application.phone },
      vars: { fullName: application.fullName, positionTitle: application.position.title, loginUrl, email: application.email, tempPassword },
    });

    return this.platformPrisma.hamzoneJobApplication.findUnique({ where: { id }, include: { position: true } });
  }
}
