import { TenantPrismaService } from './prisma/tenant-prisma.service';

/** The school's own User table lives in its tenant schema, not the platform schema — this is the
 * one cross-schema lookup platform-level services need to reach the actual School Administrator
 * account (to email/SMS them, or to set a fresh temporary password on activation). */
export async function findSchoolAdmin(tenantPrisma: TenantPrismaService, schemaName: string) {
  const db = tenantPrisma.forSchema(schemaName);
  return db.user.findFirst({
    where: { deletedAt: null, userRoles: { some: { role: { name: 'School Administrator' } } } },
    select: { id: true, email: true, fullName: true },
  });
}
