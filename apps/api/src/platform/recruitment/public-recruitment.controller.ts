import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { HamzoneApiKeyGuard, RequireApiScope } from '../crm/api-keys/hamzone-api-key.guard';
import { RecruitmentService } from './recruitment.service';
import { PublicSubmitApplicationDto } from './dto/public-submit-application.dto';

/**
 * The public, API-key-gated surface a careers page (hamzonetechnologies.com, or a Lovable-built
 * companion site) calls to list open vacancies and let applicants apply — no login, same
 * X-API-Key trust model as the rest of the public CRM surface (see PublicCrmController). Kept as
 * its own controller/module rather than folded into PublicCrmController since recruitment is a
 * distinct enough concern (with its own file-upload route) to warrant a clean split.
 */
@ApiTags('public/recruitment')
@ApiSecurity('apiKey')
@UseGuards(HamzoneApiKeyGuard)
@Controller('public/api/v1/recruitment')
export class PublicRecruitmentController {
  constructor(private readonly recruitment: RecruitmentService) {}

  @RequireApiScope('jobs:read')
  @Get('positions')
  listOpenPositions() {
    return this.recruitment.listOpenPositions();
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequireApiScope('jobs:apply')
  @Post('positions/:id/apply')
  submitApplication(@Param('id') id: string, @Body() dto: PublicSubmitApplicationDto) {
    return this.recruitment.submitApplication(id, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequireApiScope('jobs:apply')
  @Post('certificates')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadCertificate(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    return this.recruitment.saveCertificate(file);
  }
}
