import { Injectable } from '@nestjs/common';
import { PlatformPrismaService } from '../../../common/prisma/platform-prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

/** Shareable company documents (posters, certificates, brochures) — the file itself is already on
 * disk via the existing /uploads pipeline (same one a school logo goes through) by the time this
 * runs; this just records the listing so it can be found and its link shared later. */
@Injectable()
export class HamzoneDocumentsService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  list() {
    return this.platformPrisma.hamzoneDocument.findMany({
      include: { uploadedBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateDocumentDto, uploadedByUserId: string) {
    return this.platformPrisma.hamzoneDocument.create({ data: { ...dto, uploadedByUserId } });
  }

  remove(id: string) {
    return this.platformPrisma.hamzoneDocument.delete({ where: { id } });
  }
}
