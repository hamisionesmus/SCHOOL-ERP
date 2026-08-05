import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITH_PENDING_PASSWORD_CHANGE_KEY = 'allowWithPendingPasswordChange';

/** Marks a route as reachable even while the caller's PlatformUser.mustChangePassword is still
 * true — PermissionsGuard blocks every other route until they change it. Only ever needed on the
 * handful of routes someone stuck in that state must be able to hit: viewing/updating their own
 * profile, changing their own password, and logging out. */
export const AllowWithPendingPasswordChange = () => SetMetadata(ALLOW_WITH_PENDING_PASSWORD_CHANGE_KEY, true);
