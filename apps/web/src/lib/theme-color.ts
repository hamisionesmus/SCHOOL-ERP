/**
 * Small color-math helpers backing the School Administrator's sidebar/content theming (Settings
 * page). The guarantee that matters here: whatever background color a school picks, text drawn on
 * top of it stays readable — computed from relative luminance (WCAG), not guessed. Hover/active/
 * border shades are derived by mixing the background toward its own contrast color, so they read
 * correctly whether the school picked something light or dark, without per-case tuning.
 */

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Black or white, whichever has higher contrast against the given background. */
export function contrastTextColor(bgHex: string): string {
  try {
    const lum = relativeLuminance(hexToRgb(bgHex));
    return lum > 0.45 ? '#0f172a' : '#ffffff';
  } catch {
    return '#0f172a';
  }
}

/** Linear-interpolates from `hex` toward `towardHex` by `amount` (0..1). Used to derive hover/
 * active/border shades that stay in the right direction (lighter on dark bg, darker on light bg)
 * without needing to know which case we're in. */
export function mix(hex: string, towardHex: string, amount: number): string {
  try {
    const a = hexToRgb(hex);
    const b = hexToRgb(towardHex);
    const out: [number, number, number] = [
      a[0] + (b[0] - a[0]) * amount,
      a[1] + (b[1] - a[1]) * amount,
      a[2] + (b[2] - a[2]) * amount,
    ];
    return rgbToHex(out);
  } catch {
    return hex;
  }
}

export function isValidHex(value: string | null | undefined): value is string {
  return !!value && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}
