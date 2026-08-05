import { SetMetadata } from '@nestjs/common';

export const PLATFORM_ONLY_KEY = 'platformOnly';

export type PlatformRoleLiteral = 'SUPER_ADMIN' | 'ASSISTANT_SUPER_ADMIN' | 'SUB_ADMIN' | 'TRAINER' | 'GIG_WORKER';

/** Marks a route as accessible to authenticated platform-realm users. With no argument, any of the
 * three admin tiers (SUPER_ADMIN, ASSISTANT_SUPER_ADMIN, SUB_ADMIN) may call it — TRAINER is
 * deliberately excluded from the bare form (see PermissionsGuard's ADMIN_TIER_ROLES) since it's a
 * much more restricted role scoped to its own training-portal endpoints; pass `'TRAINER'`
 * explicitly (alone or alongside admin roles) wherever a trainer genuinely needs access. Passed a
 * role or list of roles otherwise, only those may — e.g. `'SUPER_ADMIN'` for Security/Backups/Audit
 * Logs/Settings/Templates/admin-roster/Tickets management, or `['SUPER_ADMIN',
 * 'ASSISTANT_SUPER_ADMIN']` for finance recording. See PermissionsGuard for enforcement. */
export const RequirePlatformRole = (roles?: PlatformRoleLiteral | PlatformRoleLiteral[]) =>
  SetMetadata(PLATFORM_ONLY_KEY, roles ? (Array.isArray(roles) ? roles : [roles]) : true);
