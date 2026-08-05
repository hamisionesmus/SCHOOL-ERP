import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { HamzoneApiKeyGuard, RequireApiScope } from '../api-keys/hamzone-api-key.guard';
import { HamzoneTrainingService } from '../training/training.service';
import { HamzoneClientsService } from '../clients/clients.service';
import { HamzoneDocumentsService } from '../documents/documents.service';

/**
 * The third-party-facing surface of the CRM — no JWT, authenticated instead via the `X-API-Key`
 * header (see HamzoneApiKeyGuard). This is what the public hamzonetechnologies.com website (or any
 * other integration) calls to show real training activity, client counts, and shareable documents
 * without a human admin session. Every route here is intentionally read-only and non-sensitive —
 * no client contact details, no invoices, no marketing leads.
 */
@ApiTags('public/crm')
@ApiSecurity('apiKey')
@UseGuards(HamzoneApiKeyGuard)
@Controller('public/api/v1/crm')
export class PublicCrmController {
  constructor(
    private readonly trainingService: HamzoneTrainingService,
    private readonly clientsService: HamzoneClientsService,
    private readonly documentsService: HamzoneDocumentsService,
  ) {}

  @RequireApiScope('training:read')
  @Get('training/overview')
  trainingOverview() {
    return this.trainingService.overview();
  }

  @RequireApiScope('clients:read')
  @Get('clients/count')
  async clientCount() {
    return { count: await this.clientsService.count() };
  }

  @RequireApiScope('documents:read')
  @Get('documents')
  documents() {
    return this.documentsService.list();
  }
}
