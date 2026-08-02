import { SetMetadata } from '@nestjs/common';

export const PLATFORM_ONLY_KEY = 'platformOnly';

/** Marks a route as accessible to authenticated platform-realm users. With no argument, any
 * platform user (SUPER_ADMIN or SUB_ADMIN) may call it. Passed `'SUPER_ADMIN'`, only the real
 * owner account may — used on Security, Backups, Audit Logs, Platform Settings, Message Templates,
 * and admin-roster management, everything a delegated Sub-Admin must not touch. See
 * PermissionsGuard for enforcement. */
export const RequirePlatformRole = (role?: 'SUPER_ADMIN') => SetMetadata(PLATFORM_ONLY_KEY, role ?? true);
