import * as bcrypt from 'bcryptjs';
import type { PrismaClient } from '../../../generated/tenant-client';

/**
 * Permission catalog and the six representative roles wired in Phase 1. Mirrors the matrix in
 * docs/RBAC.md §3 exactly — keep both in sync when extending. Remaining roles from the full list in
 * docs/RBAC.md are added here as their modules land in later phases.
 */
export const PERMISSION_CATALOG: { module: string; action: string }[] = [
  { module: 'ATTENDANCE', action: 'MARK' },
  { module: 'ATTENDANCE', action: 'VIEW' },
  { module: 'ATTENDANCE', action: 'REOPEN' },
  { module: 'ATTENDANCE', action: 'EDIT' },
  { module: 'EXAM', action: 'MANAGE' },
  { module: 'EXAM', action: 'ENTER_MARKS' },
  { module: 'EXAM', action: 'APPROVE' },
  { module: 'EXAM', action: 'REOPEN' },
  { module: 'HOMEWORK', action: 'ASSIGN' },
  { module: 'HOMEWORK', action: 'VIEW' },
  { module: 'ADMISSION', action: 'MANAGE' },
  { module: 'ANNOUNCEMENT', action: 'SEND_TO_PARENTS' },
  { module: 'FINANCE', action: 'RECEIVE_PAYMENT' },
  { module: 'FINANCE', action: 'PRINT_RECEIPT' },
  { module: 'FINANCE', action: 'APPROVE_INVOICE' },
  { module: 'FINANCE', action: 'EDIT' },
  { module: 'HR', action: 'EDIT' },
  { module: 'PAYROLL', action: 'APPROVE' },
  { module: 'LIBRARY', action: 'MANAGE' },
  { module: 'TRANSPORT', action: 'MANAGE' },
  { module: 'INVENTORY', action: 'MANAGE' },
  { module: 'HEALTH', action: 'MANAGE' },
  { module: 'DISCIPLINE', action: 'MANAGE' },
  { module: 'STUDENT', action: 'VIEW' },
  { module: 'STUDENT', action: 'CREATE' },
  { module: 'STUDENT', action: 'EDIT' },
  { module: 'STUDENT', action: 'VIEW_OWN_CHILD' },
  { module: 'STUDENT', action: 'VIEW_OWN_RECORD' },
  { module: 'TENANT', action: 'MANAGE_USERS' },
];

export const GRADE_LEVELS: { code: string; name: string; sortOrder: number }[] = [
  { code: 'PP1', name: 'Pre-Primary 1', sortOrder: 0 },
  { code: 'PP2', name: 'Pre-Primary 2', sortOrder: 1 },
  { code: 'G1', name: 'Grade 1', sortOrder: 2 },
  { code: 'G2', name: 'Grade 2', sortOrder: 3 },
  { code: 'G3', name: 'Grade 3', sortOrder: 4 },
  { code: 'G4', name: 'Grade 4', sortOrder: 5 },
  { code: 'G5', name: 'Grade 5', sortOrder: 6 },
  { code: 'G6', name: 'Grade 6', sortOrder: 7 },
  { code: 'G7', name: 'Grade 7', sortOrder: 8 },
  { code: 'G8', name: 'Grade 8', sortOrder: 9 },
  { code: 'G9', name: 'Grade 9', sortOrder: 10 },
];

const code = (module: string, action: string) => `${module}:${action}`;

export const ROLE_DEFINITIONS: { name: string; description: string; permissions: string[] }[] = [
  {
    name: 'School Administrator',
    description: 'Full administrative access within this school.',
    permissions: [
      code('ATTENDANCE', 'MARK'),
      code('ATTENDANCE', 'VIEW'),
      code('ATTENDANCE', 'REOPEN'),
      code('EXAM', 'MANAGE'),
      code('EXAM', 'ENTER_MARKS'),
      code('EXAM', 'APPROVE'),
      code('EXAM', 'REOPEN'),
      code('HOMEWORK', 'ASSIGN'),
      code('HOMEWORK', 'VIEW'),
      code('ADMISSION', 'MANAGE'),
      code('ANNOUNCEMENT', 'SEND_TO_PARENTS'),
      code('FINANCE', 'RECEIVE_PAYMENT'),
      code('FINANCE', 'PRINT_RECEIPT'),
      code('FINANCE', 'APPROVE_INVOICE'),
      code('FINANCE', 'EDIT'),
      code('HR', 'EDIT'),
      code('PAYROLL', 'APPROVE'),
      code('LIBRARY', 'MANAGE'),
      code('TRANSPORT', 'MANAGE'),
      code('INVENTORY', 'MANAGE'),
      code('HEALTH', 'MANAGE'),
      code('DISCIPLINE', 'MANAGE'),
      code('STUDENT', 'VIEW'),
      code('STUDENT', 'CREATE'),
      code('STUDENT', 'EDIT'),
      code('TENANT', 'MANAGE_USERS'),
    ],
  },
  {
    name: 'Class Teacher',
    description: "Manages own class's attendance, homework, and subject marks.",
    permissions: [
      code('ATTENDANCE', 'MARK'),
      code('ATTENDANCE', 'VIEW'),
      code('EXAM', 'ENTER_MARKS'),
      code('HOMEWORK', 'ASSIGN'),
      code('HOMEWORK', 'VIEW'),
      code('ANNOUNCEMENT', 'SEND_TO_PARENTS'),
      code('STUDENT', 'VIEW'),
    ],
  },
  {
    name: 'Finance Officer',
    description: 'Handles fees, invoices, and receipts. No academic or HR access.',
    permissions: [
      code('FINANCE', 'RECEIVE_PAYMENT'),
      code('FINANCE', 'PRINT_RECEIPT'),
      code('FINANCE', 'APPROVE_INVOICE'),
      code('FINANCE', 'EDIT'),
      code('STUDENT', 'VIEW'),
    ],
  },
  {
    name: 'Parent',
    description: "Views own children's records only.",
    permissions: [code('STUDENT', 'VIEW_OWN_CHILD')],
  },
  {
    name: 'Student',
    description: 'Views own record only.',
    permissions: [code('STUDENT', 'VIEW_OWN_RECORD')],
  },
];

export interface TenantAdminSeed {
  email: string;
  fullName: string;
  password: string;
}

/**
 * Upserts the permission catalog, the representative roles (with their permission grants), and grade
 * levels for a tenant. Purely additive/idempotent — safe to re-run against an existing tenant after
 * extending PERMISSION_CATALOG/ROLE_DEFINITIONS in a later phase (see prisma/reseed-all-tenants.ts).
 * Returns the School Administrator role id so callers can attach an admin user if needed.
 */
export async function seedPermissionsAndRoles(db: PrismaClient): Promise<{ adminRoleId: string | null }> {
  const permissionsByCode = new Map<string, { id: string }>();
  for (const p of PERMISSION_CATALOG) {
    const perm = await db.permission.upsert({
      where: { code: code(p.module, p.action) },
      update: {},
      create: { module: p.module, action: p.action, code: code(p.module, p.action) },
    });
    permissionsByCode.set(perm.code, perm);
  }

  for (const grade of GRADE_LEVELS) {
    await db.gradeLevel.upsert({ where: { code: grade.code }, update: {}, create: grade });
  }

  let adminRoleId: string | null = null;
  for (const roleDef of ROLE_DEFINITIONS) {
    const role = await db.role.upsert({
      where: { name: roleDef.name },
      update: {},
      create: { name: roleDef.name, description: roleDef.description, isSystemRole: true },
    });
    if (roleDef.name === 'School Administrator') adminRoleId = role.id;

    for (const permCode of roleDef.permissions) {
      const permission = permissionsByCode.get(permCode);
      if (!permission) continue;
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  return { adminRoleId };
}

/** Seeds permissions/roles/grade levels, then creates the first School Administrator. */
export async function seedTenantCore(db: PrismaClient, admin: TenantAdminSeed) {
  const { adminRoleId } = await seedPermissionsAndRoles(db);

  const passwordHash = await bcrypt.hash(admin.password, 12);
  const adminUser = await db.user.upsert({
    where: { email: admin.email },
    update: {},
    create: { email: admin.email, fullName: admin.fullName, passwordHash },
  });

  if (adminRoleId) {
    await db.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: adminRoleId } },
      update: {},
      create: { userId: adminUser.id, roleId: adminRoleId },
    });
  }

  return adminUser;
}
