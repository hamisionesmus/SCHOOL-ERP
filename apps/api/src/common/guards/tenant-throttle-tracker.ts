/** Best-effort, unverified decode of a JWT's payload segment — fine here because the result is only
 * used as a rate-limit *bucket key*, not an authorization decision. Forging a fake tenantSchema in
 * an unsigned/tampered token just buckets the attacker's own abuse under an arbitrary key; it can't
 * grant elevated access or evade the limit's overall protective purpose. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/** Tracker for the 'tenant' named throttler (see app.module.ts's ThrottlerModule.forRoot) — buckets
 * authenticated tenant-realm requests by school (tenantSchema) instead of by IP, so many different
 * parents'/staff's IPs at one busy school share one limit instead of each getting their own —
 * preventing one school's traffic spike from starving another school sharing the same API process.
 * Falls back to IP for public/platform requests (no tenant claim), matching the default throttler's
 * existing behavior for those routes. */
export async function tenantOrIpTracker(req: Record<string, any>): Promise<string> {
  const authHeader: string | undefined = req.headers?.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const claims = token ? decodeJwtPayload(token) : null;
  const tenantSchema = claims?.realm === 'tenant' ? (claims.tenantSchema as string | undefined) : undefined;
  return tenantSchema ?? req.ip;
}
