export const MAILBOX_KEYS = ['INFO', 'PARTNER', 'BILLING', 'PERSONAL'] as const;
export type MailboxKey = (typeof MAILBOX_KEYS)[number];

// Seed defaults for the 4 fixed identities — the Super Admin can correct the address/displayName
// via the credentials-update form if any of these guesses are off, so a typo here isn't fatal.
export const MAILBOX_DEFAULTS: Record<MailboxKey, { address: string; displayName: string }> = {
  INFO: { address: 'info@hamzonetechnologies.com', displayName: 'Hamzone Technologies' },
  PARTNER: { address: 'partner@hamzonetechnologies.com', displayName: 'Hamzone Technologies Partnerships' },
  BILLING: { address: 'billing@hamzonetechnologies.com', displayName: 'Hamzone Technologies Billing' },
  PERSONAL: { address: 'hamisi@hamzonetechnologies.com', displayName: 'Hamisi — Hamzone Technologies' },
};

// Only BILLING is visible to Assistant Super Admin — the other three stay Super-Admin-only.
export const ASSISTANT_SUPER_ADMIN_VISIBLE_KEYS: readonly MailboxKey[] = ['BILLING'];

/** Single source of truth for "can this platform role see/use this mailbox" — used by every
 * mailboxes.controller.ts handler that takes a `:key` route param, since the restriction depends on
 * which mailbox is being accessed, not just the caller's role, so a static `@RequirePlatformRole()`
 * decorator alone can't express it. */
export function canRoleAccessMailbox(role: string | undefined, key: MailboxKey): boolean {
  if (role === 'SUPER_ADMIN') return true;
  if (role === 'ASSISTANT_SUPER_ADMIN') return (ASSISTANT_SUPER_ADMIN_VISIBLE_KEYS as string[]).includes(key);
  return false;
}

export function accessibleMailboxKeys(role: string | undefined): readonly MailboxKey[] {
  if (role === 'SUPER_ADMIN') return MAILBOX_KEYS;
  if (role === 'ASSISTANT_SUPER_ADMIN') return ASSISTANT_SUPER_ADMIN_VISIBLE_KEYS;
  return [];
}
