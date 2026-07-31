import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PLATFORM_ONLY_KEY } from '../decorators/require-platform-role.decorator';
import { JwtUserPayload } from '../decorators/current-user.decorator';

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
    const platformOnly = this.reflector.getAllAndOverride<boolean | undefined>(PLATFORM_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user: JwtUserPayload | undefined = request.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    if (platformOnly && user.realm !== 'platform') {
      throw new ForbiddenException('Super Admin access required');
    }

    if (requiredPermission) {
      if (user.realm !== 'tenant' || !user.permissions?.includes(requiredPermission)) {
        throw new ForbiddenException(`Missing permission: ${requiredPermission}`);
      }
    }

    return true;
  }
}
