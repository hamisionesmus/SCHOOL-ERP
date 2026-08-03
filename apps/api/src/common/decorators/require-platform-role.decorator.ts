import { SetMetadata } from '@nestjs/common';

export const PLATFORM_ONLY_KEY = 'platformOnly';

export type PlatformRoleLiteral = 'SUPER_ADMIN' | 'ASSISTANT_SUPER_ADMIN' | 'SUB_ADMIN';

/** Marks a route as accessible to authenticated platform-realm users. With no argument, any
 * platform user (SUPER_ADMIN, ASSISTANT_SUPER_ADMIN, or SUB_ADMIN) may call it. Passed a role or
 * list of roles, only those may — e.g. `'SUPER_ADMIN'` for Security/Backups/Audit
 * Logs/Settings/Templates/admin-roster/Tickets management, or `['SUPER_ADMIN',
 * 'ASSISTANT_SUPER_ADMIN']` for finance recording. See PermissionsGuard for enforcement. */
export const RequirePlatformRole = (roles?: PlatformRoleLiteral | PlatformRoleLiteral[]) =>
  SetMetadata(PLATFORM_ONLY_KEY, roles ? (Array.isArray(roles) ? roles : [roles]) : true);
