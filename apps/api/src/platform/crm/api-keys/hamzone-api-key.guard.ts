import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HamzoneApiKeysService } from './api-keys.service';

export const REQUIRED_SCOPE_KEY = 'hamzoneApiScope';
/** Marks a public-controller route as requiring a specific HamzoneApiKey scope — paired with
 * HamzoneApiKeyGuard, which reads this metadata to know which scope to check. */
export const RequireApiScope = (scope: string) => SetMetadata(REQUIRED_SCOPE_KEY, scope);

/** Authenticates a request via the `X-API-Key` header instead of a JWT — the gate on every
 * /public/api/v1/... endpoint, so Hamzone's own website (or any other third party) can pull select
 * CRM data without a human login session. See HamzoneApiKeysService.verify(). */
@Injectable()
export class HamzoneApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeys: HamzoneApiKeysService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scope = this.reflector.get<string>(REQUIRED_SCOPE_KEY, context.getHandler());
    const request = context.switchToHttp().getRequest();
    const rawKey = request.headers['x-api-key'];
    if (!rawKey || typeof rawKey !== 'string') {
      throw new UnauthorizedException('Missing X-API-Key header');
    }
    try {
      await this.apiKeys.verify(rawKey, scope);
    } catch (err) {
      throw new UnauthorizedException(err instanceof Error ? err.message : 'Invalid API key');
    }
    return true;
  }
}
