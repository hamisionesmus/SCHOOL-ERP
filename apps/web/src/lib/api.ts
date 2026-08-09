import { clearSession, getAccessToken, getRefreshToken, storeSession, type SessionUser } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Refresh tokens are single-use and rotated server-side (the old one is revoked the instant it's
// redeemed — see AuthService.refresh). A page that fires several queries at once (e.g. Settings:
// /settings, /roles, /workflows/definitions/..., /notifications) can get several 401s in the same
// tick once the access token expires; without de-duping, each would independently POST the same
// stored refresh token, only the first would succeed, and the others would 401 on an already-revoked
// token and call clearSession() -- wiping out the valid tokens the winner just stored a moment
// earlier. Sharing one in-flight promise means concurrent 401s all await the same real refresh.
let refreshPromise: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  storeSession(data.accessToken, data.refreshToken, data.user as SessionUser);
  return true;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && retry && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiFetch<T>(path, options, false);
    clearSession();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Multipart upload — deliberately bypasses apiFetch's JSON Content-Type so the browser can set
 * the multipart boundary itself. Returns the relative /uploads/... URL to store on a record. */
export async function apiUpload(file: File): Promise<{ url: string }> {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? 'Upload failed');
  }
  return res.json();
}

export const API_ORIGIN = API_URL;
