import { SetMetadata } from '@nestjs/common';

export const PLATFORM_ONLY_KEY = 'platformOnly';

/** Marks a route as accessible only to authenticated Super Admin (platform-realm) users. */
export const RequirePlatformRole = () => SetMetadata(PLATFORM_ONLY_KEY, true);
