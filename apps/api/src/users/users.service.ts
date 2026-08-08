import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { UserDirectoryService } from '../common/user-directory/user-directory.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { generateTempPassword } from '../common/password.util';
import { buildWorkbook, ExcelColumn } from '../common/excel/excel-builder.util';
import { parseWorkbook, RowError } from '../common/excel/excel-parser.util';
import { USER_IMPORT_INSTRUCTIONS } from './users-import-instructions';

interface UserExportRow {
  email: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  userRoles: { role: { name: string } }[];
}

@Injectable()
export class UsersService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly userDirectory: UserDirectoryService,
  ) {}

  async list(user: JwtUserPayload) {
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

  async create(user: JwtUserPayload, dto: CreateUserDto) {
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

  // ---- Excel import/export — see docs/IMPORT_EXPORT.md ----

  private userColumns(): ExcelColumn<UserExportRow>[] {
    return [
      { header: 'Email', key: 'email', required: true, getValue: (r) => r.email },
      { header: 'Full Name', key: 'fullName', required: true, getValue: (r) => r.fullName },
      { header: 'Phone', key: 'phone', getValue: (r) => r.phone },
      { header: 'Roles', key: 'roles', getValue: (r) => r.userRoles.map((ur) => ur.role.name).join(', ') },
    ];
  }

  async exportExcel(user: JwtUserPayload): Promise<Buffer> {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const users = await db.user.findMany({
      where: { deletedAt: null },
      include: { userRoles: { include: { role: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return buildWorkbook({ sheetName: 'Staff', columns: this.userColumns(), rows: users });
  }

  async importTemplateExcel(): Promise<Buffer> {
    return buildWorkbook({
      sheetName: 'Staff',
      columns: this.userColumns(),
      rows: [],
      instructions: USER_IMPORT_INSTRUCTIONS,
    });
  }

  async importFromExcel(user: JwtUserPayload, buffer: Buffer) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const columns = this.userColumns();
    const { rows, headerErrors } = await parseWorkbook(buffer, columns.map((c) => ({ header: c.header, key: c.key })));
    if (headerErrors.length > 0) return { created: 0, updated: 0, errors: headerErrors };

    const errors: RowError[] = [];
    const seenEmails = new Map<string, number[]>();
    for (const row of rows) {
      const key = String(row.data.email ?? '').trim().toLowerCase();
      if (!key) continue;
      seenEmails.set(key, [...(seenEmails.get(key) ?? []), row.rowNumber]);
    }
    for (const [key, rowNumbers] of seenEmails) {
      if (rowNumbers.length > 1) {
        for (const rn of rowNumbers) {
          errors.push({ row: rn, field: 'email', message: `Email ${key} appears on rows ${rowNumbers.join(', ')} — fix duplicates before importing.` });
        }
      }
    }

    const allRoles = await db.role.findMany();
    const roleByName = new Map(allRoles.map((r) => [r.name.toLowerCase(), r]));

    type Planned = {
      row: number;
      isUpdate: boolean;
      existingId?: string;
      email: string;
      fullName?: string;
      phone?: string;
      roleIds?: string[];
    };
    const planned: Planned[] = [];

    for (const row of rows) {
      const email = String(row.data.email ?? '').trim().toLowerCase();
      if ((seenEmails.get(email)?.length ?? 0) > 1) continue;

      if (!email) {
        errors.push({ row: row.rowNumber, field: 'email', message: 'Email is required.' });
        continue;
      }

      const existing = await db.user.findUnique({ where: { email } });
      const fullName = String(row.data.fullName ?? '').trim();
      const phone = row.data.phone ? String(row.data.phone) : undefined;
      const rolesRaw = String(row.data.roles ?? '').trim();

      if (!existing && !fullName) {
        errors.push({ row: row.rowNumber, field: 'fullName', message: 'Full Name is required for a new account.' });
        continue;
      }

      let roleIds: string[] | undefined;
      if (rolesRaw) {
        const roleNames = rolesRaw.split(',').map((r) => r.trim()).filter(Boolean);
        const resolved: string[] = [];
        let bad = false;
        for (const name of roleNames) {
          const role = roleByName.get(name.toLowerCase());
          if (!role) {
            errors.push({ row: row.rowNumber, field: 'roles', message: `No role named "${name}" — valid roles: ${[...roleByName.values()].map((r) => r.name).join(', ')}.` });
            bad = true;
          } else {
            resolved.push(role.id);
          }
        }
        if (!bad) roleIds = resolved;
      } else if (!existing) {
        errors.push({ row: row.rowNumber, field: 'roles', message: 'Roles is required for a new account.' });
        continue;
      }

      planned.push({
        row: row.rowNumber,
        isUpdate: !!existing,
        existingId: existing?.id,
        email,
        fullName: fullName || undefined,
        phone,
        roleIds,
      });
    }

    if (errors.length > 0) return { created: 0, updated: 0, errors };

    let created = 0;
    let updated = 0;
    const notes: string[] = [];

    for (const p of planned) {
      if (p.isUpdate && p.existingId) {
        await db.user.update({
          where: { id: p.existingId },
          data: { ...(p.fullName ? { fullName: p.fullName } : {}), ...(p.phone ? { phone: p.phone } : {}) },
        });
        if (p.roleIds) {
          await db.userRole.deleteMany({ where: { userId: p.existingId } });
          await db.userRole.createMany({ data: p.roleIds.map((roleId) => ({ userId: p.existingId!, roleId })) });
        }
        updated++;
      } else {
        await this.userDirectory.reserveForSchema(p.email, user.tenantSchema!);
        const tempPassword = generateTempPassword();
        const passwordHash = await bcrypt.hash(tempPassword, 12);
        await db.user.create({
          data: {
            email: p.email,
            fullName: p.fullName!,
            phone: p.phone,
            passwordHash,
            userRoles: { create: (p.roleIds ?? []).map((roleId) => ({ roleId })) },
          },
        });
        notes.push(`${p.email} — temp password: ${tempPassword}`);
        created++;
      }
    }

    return { created, updated, errors: [], notes };
  }
}
