import { SetMetadata } from '@nestjs/common';
import { PlatformModule } from '../../platform/admins/platform-modules';

export const PLATFORM_MODULE_KEY = 'platformModule';

/** Names which grantable module a Super-Admin-only route belongs to, so PermissionsGuard can also
 * let in a Sub-Admin/Assistant Super Admin who's been individually granted that module (see
 * PlatformAdminModuleGrant) — applied alongside @RequirePlatformRole('SUPER_ADMIN'), never instead
 * of it, since the tier check still governs every other Super-Admin-only route. */
export const RequirePlatformModule = (module: PlatformModule) => SetMetadata(PLATFORM_MODULE_KEY, module);
