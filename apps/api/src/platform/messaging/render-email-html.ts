/**
 * Wraps a plain-text email body (the same string already sent as `text`) in a minimal HTML shell —
 * logo at top if configured, line breaks preserved. Inline styles only, no external stylesheet, for
 * email-client compatibility. This is additive alongside the existing plain-text body, not a replacement
 * — every provider still gets both `text` and `html`.
 */
export function wrapWithLogo(bodyText: string, logoUrl: string | null): string {
  const escaped = bodyText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const logoHtml = logoUrl
    ? `<div style="text-align:center;margin-bottom:24px;">
         <img src="${logoUrl}" alt="Hamzone Technologies" style="max-height:56px;max-width:220px;" />
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
