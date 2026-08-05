import { Injectable } from '@nestjs/common';
import { PlatformPrismaService } from '../../../common/prisma/platform-prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

/** Shareable company documents (posters, certificates, brochures) — the file itself is already on
 * disk via the existing /uploads pipeline (same one a school logo goes through) by the time this
 * runs; this just records the listing so it can be found and its link shared later. */
@Injectable()
export class HamzoneDocumentsService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  list(trainingProgramId?: string) {
    return this.platformPrisma.hamzoneDocument.findMany({
      where: trainingProgramId ? { trainingProgramId } : {},
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
        fileUrl: dto.fileUrl,
        trainingProgramId: dto.trainingProgramId,
        uploadedByUserId,
        suggestedByUserId: isTrainerSuggestion ? uploadedByUserId : undefined,
      },
    });
  }

  remove(id: string) {
    return this.platformPrisma.hamzoneDocument.delete({ where: { id } });
  }
}
