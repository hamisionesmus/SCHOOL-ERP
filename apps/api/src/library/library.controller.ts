import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { LibraryService } from './library.service';
import { CreateBookDto } from './dto/create-book.dto';
import { IssueLoanDto } from './dto/issue-loan.dto';

@ApiTags('library')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get('books')
  listBooks(@CurrentUser() user: JwtUserPayload) {
    return this.libraryService.listBooks(user);
  }

  @Post('books')
  @RequirePermission('LIBRARY:MANAGE')
  createBook(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateBookDto) {
    return this.libraryService.createBook(user, dto);
  }

  @Get('loans')
  listLoans(@CurrentUser() user: JwtUserPayload) {
    return this.libraryService.listLoans(user);
  }

  @Post('loans')
  @RequirePermission('LIBRARY:MANAGE')
  issueLoan(@CurrentUser() user: JwtUserPayload, @Body() dto: IssueLoanDto) {
    return this.libraryService.issueLoan(user, dto);
  }

  @Patch('loans/:id/return')
  @RequirePermission('LIBRARY:MANAGE')
  returnLoan(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.libraryService.returnLoan(user, id);
  }
}
