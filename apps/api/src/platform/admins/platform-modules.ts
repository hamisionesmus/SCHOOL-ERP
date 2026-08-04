// Fixed, code-enforced set of platform modules a Super Admin can grant to a specific Sub-Admin or
// Assistant Super Admin via PlatformAdminModuleGrant — an override on top of (not a replacement
// for) their tier's default access, checked by PermissionsGuard alongside the tier-based role check.
export const PLATFORM_MODULES = [
  'TICKETS',
  'SECURITY',
  'BACKUPS',
  'SETTINGS',
  'MESSAGE_TEMPLATES',
  'ADMINS',
  'AUDIT_LOG',
] as const;

export type PlatformModule = (typeof PLATFORM_MODULES)[number];

export const PLATFORM_MODULE_LABELS: Record<PlatformModule, string> = {
  TICKETS: 'Tickets',
  SECURITY: 'Security',
  BACKUPS: 'Backups',
  SETTINGS: 'Platform Settings',
  MESSAGE_TEMPLATES: 'Message Templates',
  ADMINS: 'Admin management',
  AUDIT_LOG: 'Audit Log access',
};

export function isPlatformModule(value: string): value is PlatformModule {
  return (PLATFORM_MODULES as readonly string[]).includes(value);
}
