import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PLATFORM_ONLY_KEY } from '../decorators/require-platform-role.decorator';
import { PLATFORM_MODULE_KEY } from '../decorators/require-platform-module.decorator';
import { JwtUserPayload } from '../decorators/current-user.decorator';

// The three admin tiers a bare @RequirePlatformRole() (no explicit role list) has always meant —
// kept as an explicit whitelist so adding a new platform role (e.g. TRAINER, scoped to a handful
// of its own endpoints) never silently gains access to every admin-tier route that just uses the
// bare decorator. A new role must be named explicitly wherever it should reach.
const ADMIN_TIER_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'];

/**
 * Server-side RBAC enforcement. Effective permission codes are embedded in the JWT at login time
 * (see AuthService) rather than re-fetched per request — a deliberate trade-off documented in
 * docs/ARCHITECTURE.md §4: a role/permission change takes effect on the user's next login/refresh,
 * not instantly, in exchange for not hitting the DB on every request.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<string | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const platformOnly = this.reflector.getAllAndOverride<boolean | string[] | undefined>(PLATFORM_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredModule = this.reflector.getAllAndOverride<string | undefined>(PLATFORM_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user: JwtUserPayload | undefined = request.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    if (platformOnly && user.realm !== 'platform') {
      throw new ForbiddenException('Super Admin access required');
    }
    if (platformOnly === true && !ADMIN_TIER_ROLES.includes(user.role ?? '')) {
      throw new ForbiddenException('Admin access required');
    }
    if (Array.isArray(platformOnly) && !platformOnly.includes(user.role ?? '')) {
      // A per-admin module grant (see PlatformAdminModuleGrant) lets a Sub-Admin/Assistant Super
      // Admin through a tier-restricted route without changing their overall role tier.
      const hasGrant = !!requiredModule && !!user.moduleGrants?.includes(requiredModule);
      if (!hasGrant) throw new ForbiddenException('Super Admin access required');
    }

    if (requiredPermission) {
      if (user.realm !== 'tenant' || !user.permissions?.includes(requiredPermission)) {
        throw new ForbiddenException(`Missing permission: ${requiredPermission}`);
      }
    }

    return true;
  }
}
