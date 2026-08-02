import { randomInt } from 'node:crypto';

// Excludes visually ambiguous characters (0/O, 1/l/I, etc.) — a temp password shown once on screen
// and hand-relayed/retyped by someone else is exactly the case where a look-alike character causes a
// silent, hard-to-diagnose login failure. See docs/SRS.md §4.1.
const UNAMBIGUOUS_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function generateTempPassword(length = 12): string {
  let out = '';
  for (let i = 0; i < length; i++) out += UNAMBIGUOUS_CHARS[randomInt(UNAMBIGUOUS_CHARS.length)];
  return out;
}
