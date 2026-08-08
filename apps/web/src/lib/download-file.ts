import { getAccessToken } from './auth';
import { API_ORIGIN, ApiError } from './api';

/** Fetches a file (PDF, Excel, etc.) as an authenticated blob and triggers a browser download —
 * the same pattern this codebase already used inline in ~5 places for PDF downloads. */
export async function downloadFile(path: string, fallbackFilename: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_ORIGIN}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? 'Download failed');
  }
  const disposition = res.headers.get('Content-Disposition');
  const match = disposition?.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? fallbackFilename;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ExcelImportResult {
  created: number;
  updated: number;
  /** Rows safely skipped as already-processed (e.g. a payment Reference already recorded) — not an error. */
  skipped?: number;
  /** Free-text info to relay back (e.g. generated temp passwords for newly created staff accounts). */
  notes?: string[];
  errors: { row: number; field?: string; message: string }[];
}

/** Uploads a filled-in Excel file to an import endpoint — mirrors apiUpload's multipart pattern. */
export async function uploadExcelFile(path: string, file: File): Promise<ExcelImportResult> {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_ORIGIN}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? 'Import failed');
  }
  return res.json();
}
