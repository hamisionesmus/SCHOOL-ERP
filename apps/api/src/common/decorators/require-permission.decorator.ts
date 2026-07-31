import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

/** Marks a route as requiring the given `MODULE:ACTION` permission code. See docs/RBAC.md. */
export const RequirePermission = (code: string) => SetMetadata(PERMISSION_KEY, code);
