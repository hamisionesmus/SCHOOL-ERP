import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUserPayload {
  sub: string;
  realm: 'platform' | 'tenant';
  fullName: string;
  email: string;
  tenantSchema?: string;
  tenantSlug?: string;
  roles?: string[];
  permissions?: string[];
  // Platform-realm only: 'SUPER_ADMIN' | 'ASSISTANT_SUPER_ADMIN' | 'SUB_ADMIN' — see
  // RequirePlatformRole/PermissionsGuard for how this restricts each tier.
  role?: string;
  // Platform-realm only: per-admin module overrides granted by a Super Admin on top of the tier
  // default (see PlatformAdminModuleGrant, RequirePlatformModule/PermissionsGuard). Embedded in the
  // JWT the same way `role` is — a grant change takes effect on next login/refresh, not instantly.
  moduleGrants?: string[];
  // Platform-realm only: true immediately after account creation with a system-generated temp
  // password (trainers, gig workers, recruitment hires, invited admins) — PermissionsGuard blocks
  // every route except the change-password/own-profile ones until this clears. See
  // AllowWithPendingPasswordChange and PlatformUser.mustChangePassword.
  mustChangePassword?: boolean;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtUserPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
