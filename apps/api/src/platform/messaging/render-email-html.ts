import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { EmailAttachment } from '../email/email-provider.interface';

const LOGO_CID = 'brand-logo';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * Reads the configured login logo off local disk and returns it as an inline (`cid:`) attachment.
 * Deliberately NOT a hosted `<img src="https://...">` — that requires the API's own public origin
 * to be known server-side (a prior attempt via an API_ORIGIN env var broke in production because
 * the server's real .env was never updated with it, and Gmail/most clients also proxy-fetch remote
 * image URLs which can fail for other reasons). A CID-embedded attachment ships the image bytes
 * inside the email itself — no public reachability required, universally supported (Gmail included).
 */
export async function buildLogoAttachment(loginLogoUrl: string | null): Promise<EmailAttachment | null> {
  if (!loginLogoUrl) return null;
  const ext = extname(loginLogoUrl).toLowerCase();
  const contentType = MIME_BY_EXT[ext];
  if (!contentType) return null;

  try {
    // loginLogoUrl is stored as e.g. "/uploads/platform/<uuid>.jpeg" — the same relative path
    // UploadsService writes to on disk (see uploads.service.ts's save()), rooted at process.cwd().
    const diskPath = join(process.cwd(), loginLogoUrl.replace(/^\//, ''));
    const content = await readFile(diskPath);
    return { filename: `logo${ext}`, content, contentType, cid: LOGO_CID };
  } catch {
    // Logo file missing/unreadable on disk — degrade to no logo rather than failing the whole send.
    return null;
  }
}

/**
 * Wraps a plain-text email body (the same string already sent as `text`) in a minimal HTML shell —
 * logo at top if an inline attachment was built, line breaks preserved. Inline styles only, no
 * external stylesheet, for email-client compatibility. Additive alongside the existing plain-text
 * body — every provider still gets both `text` and `html`.
 */
export function wrapWithLogo(bodyText: string, hasLogo: boolean): string {
  const escaped = bodyText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const logoHtml = hasLogo
    ? `<div style="text-align:center;margin-bottom:24px;">
         <img src="cid:${LOGO_CID}" alt="Hamzone Technologies" style="max-height:56px;max-width:220px;" />
       </div>`
    : '';

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f5f7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;padding:32px;font-family:Arial,Helvetica,sans-serif;">
            <tr>
              <td>
                ${logoHtml}
                <div style="font-size:14px;line-height:1.6;color:#1e293b;">${escaped}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
