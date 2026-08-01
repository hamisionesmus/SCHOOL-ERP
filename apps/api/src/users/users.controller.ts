import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { UserDirectoryService } from '../common/user-directory/user-directory.service';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('TENANT:MANAGE_USERS')
@Controller('users')
export class UsersController {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly userDirectory: UserDirectoryService,
  ) {}

  @Get()
  async list(@CurrentUser() user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        createdAt: true,
        userRoles: { include: { role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  async create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateUserDto) {
    await this.userDirectory.reserveForSchema(dto.email, user.tenantSchema!);
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    return db.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        passwordHash,
        userRoles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
      },
      include: { userRoles: { include: { role: true } } },
    });
  }
}
