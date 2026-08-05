import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../../../common/prisma/platform-prisma.service';
import { JwtUserPayload } from '../../../common/decorators/current-user.decorator';
import { CreateDocumentDto } from './dto/create-document.dto';

const ADMIN_TIER_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'];

/** Shareable company documents (posters, certificates, brochures) — the file itself is already on
 * disk via the existing /uploads pipeline (same one a school logo goes through) by the time this
 * runs; this just records the listing so it can be found and its link shared later. */
@Injectable()
export class HamzoneDocumentsService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

/** Full, unscoped list — used both for an admin-tier caller and for the public API-key surface
   * (whose trust boundary is the key's scope, not a PlatformUser identity, so there's no "role" to
   * scope by). Kept private-ish (no role check inside) — callers are responsible for only reaching
   * it when that's the correct access level. */
  listAll(trainingProgramId?: string) {
    return this.platformPrisma.hamzoneDocument.findMany({
      where: trainingProgramId ? { trainingProgramId } : {},
      include: { uploadedBy: { select: { fullName: true } }, suggestedBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Admin tiers see everything (optionally filtered to one program via the query param). A TRAINER
   * only ever sees documents with no program (general company-wide resources) plus ones tied to a
   * program they're actually assigned to — never the whole company's document library, and the
   * `trainingProgramId` query param is ignored for them so they can't widen it by hand. */
  async list(trainingProgramId: string | undefined, user: JwtUserPayload) {
    if (ADMIN_TIER_ROLES.includes(user.role ?? '')) {
      return this.listAll(trainingProgramId);
    }

    const profile = await this.platformPrisma.hamzoneTrainerProfile.findUnique({ where: { userId: user.sub } });
    const programIds = profile
      ? (
          await this.platformPrisma.hamzoneTrainingProgram.findMany({
            where: { trainerId: profile.id },
            select: { id: true },
          })
        ).map((p) => p.id)
      : [];

    return this.platformPrisma.hamzoneDocument.findMany({
      where: { OR: [{ trainingProgramId: null }, { trainingProgramId: { in: programIds } }] },
      include: { uploadedBy: { select: { fullName: true } }, suggestedBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** `suggestedByUserId` is set (rather than `uploadedByUserId`) when a trainer is the one
   * proposing the addition — distinguishes "a lead shared this resource" from "a trainer suggested
   * we add this" without a separate approval workflow. */
  create(dto: CreateDocumentDto, uploadedByUserId: string, isTrainerSuggestion: boolean) {
    return this.platformPrisma.hamzoneDocument.create({
      data: {
        title: dto.title,
        category: dto.category,
        categoryOther: dto.categoryOther,
        fileUrl: dto.fileUrl,
        trainingProgramId: dto.trainingProgramId,
        uploadedByUserId,
        suggestedByUserId: isTrainerSuggestion ? uploadedByUserId : undefined,
      },
    });
  }

  /** Admin tiers can remove anything; a TRAINER can only remove a document they themselves
   * suggested — never something a lead/admin uploaded, and never another trainer's suggestion. */
  async remove(id: string, user: JwtUserPayload) {
    if (!ADMIN_TIER_ROLES.includes(user.role ?? '')) {
      const doc = await this.platformPrisma.hamzoneDocument.findUnique({ where: { id } });
      if (!doc) throw new NotFoundException('Document not found');
      if (doc.suggestedByUserId !== user.sub) {
        throw new ForbiddenException('You can only remove resources you suggested yourself');
      }
    }
    return this.platformPrisma.hamzoneDocument.delete({ where: { id } });
  }
}
