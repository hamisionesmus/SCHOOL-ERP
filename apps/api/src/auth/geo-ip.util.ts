const PRIVATE_IP_PATTERNS = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^::1$/, /^::ffff:127\./];

function isPrivateOrLocal(ip: string): boolean {
  return !ip || PRIVATE_IP_PATTERNS.some((p) => p.test(ip));
}

/** Best-effort IP geolocation via ipapi.co's free, keyless tier — used only to give the Super Admin
 * a rough "where is this login/attempt coming from" signal on the Security page, never to gate
 * anything. Always resolves (never throws): returns nulls on a private IP, network error, timeout,
 * or rate-limit response, so a slow/unavailable third party can never delay or block a login. */
export async function lookupIpGeo(ip: string | undefined): Promise<{ city: string | null; country: string | null }> {
  if (!ip || isPrivateOrLocal(ip)) return { city: null, country: null };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { city: null, country: null };
    const data = (await res.json()) as { city?: string; country_name?: string; error?: boolean };
    if (data.error) return { city: null, country: null };
    return { city: data.city ?? null, country: data.country_name ?? null };
  } catch {
    return { city: null, country: null };
  }
}
