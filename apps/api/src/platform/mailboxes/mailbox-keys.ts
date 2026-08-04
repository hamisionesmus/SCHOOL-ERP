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

// The 3 mailboxes a Sub-Admin/Assistant Super Admin can *start a restricted conversation with*
// (never PERSONAL — that's Hamisi's own address, not a platform team inbox).
export const CONTACTABLE_KEYS: readonly MailboxKey[] = ['INFO', 'PARTNER', 'BILLING'];

/** A separate, narrower authorization path from canRoleAccessMailbox() above: "can this role send a
 * restricted contact-the-platform-team message to this mailbox," not "can this role browse the full
 * inbox." Super Admin can do everything canRoleAccessMailbox already allows; Sub-Admin and Assistant
 * Super Admin — who either have no or only partial full-inbox access — can additionally reach any
 * contactable mailbox this way, scoped to only their own resulting thread (see
 * MailboxesService.contact()/myThreads()). */
export function canRoleContactMailbox(role: string | undefined, key: MailboxKey): boolean {
  if (role === 'SUPER_ADMIN') return true;
  if (role === 'ASSISTANT_SUPER_ADMIN' || role === 'SUB_ADMIN') {
    return (CONTACTABLE_KEYS as string[]).includes(key);
  }
  return false;
}
