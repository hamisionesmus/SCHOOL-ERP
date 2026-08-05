import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../../common/decorators/current-user.decorator';
import { HamzoneDocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';

// TRAINER is included here specifically (unlike the rest of the CRM) so trainers can see resources
// leads have uploaded and upload/"suggest" their own additions — see HamzoneDocumentsService.create().
@ApiTags('platform/crm/documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN', 'TRAINER'])
@Controller('platform/crm/documents')
export class HamzoneDocumentsController {
  constructor(private readonly documents: HamzoneDocumentsService) {}

  @Get()
  list(@Query('trainingProgramId') trainingProgramId: string | undefined, @CurrentUser() user: JwtUserPayload) {
    return this.documents.list(trainingProgramId, user);
  }

  @Post()
  create(@Body() dto: CreateDocumentDto, @CurrentUser() user: JwtUserPayload) {
    return this.documents.create(dto, user.sub, user.role === 'TRAINER');
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtUserPayload) {
    return this.documents.remove(id, user);
  }
}
