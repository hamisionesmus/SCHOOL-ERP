import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HamzoneApiKeyGuard, RequireApiScope } from '../api-keys/hamzone-api-key.guard';
import { HamzoneTrainingService } from '../training/training.service';
import { HamzoneClientsService } from '../clients/clients.service';
import { HamzoneDocumentsService } from '../documents/documents.service';
import { HamzoneLeadsService } from '../leads/leads.service';
import { PublicSubmitLeadDto } from '../leads/dto/public-submit-lead.dto';

/**
 * The third-party-facing surface of the CRM — no JWT, authenticated instead via the `X-API-Key`
 * header (see HamzoneApiKeyGuard). This is what the public hamzonetechnologies.com website (or any
 * other integration, e.g. a Lovable-built marketing site) calls to show real training activity,
 * client counts, shareable documents, and to submit a contact-form enquiry — all read routes are
 * non-sensitive (no client contact details, no invoices), and the one write route (`leads`) only
 * ever creates a new lead, never reads or updates existing CRM data.
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
    private readonly leadsService: HamzoneLeadsService,
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

  // Rate-limited independently of the read routes above — a contact-form key is realistically
  // reachable from a browser (embedded in a public site's JS), so it needs its own abuse guard
  // beyond just the scope check.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequireApiScope('leads:write')
  @Post('leads')
  submitLead(@Body() dto: PublicSubmitLeadDto) {
    return this.leadsService.createPublic(dto);
  }
}
