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
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtUserPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
