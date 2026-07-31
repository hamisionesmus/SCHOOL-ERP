// Cross-app shared types and constants. Currently type-only (no runtime build step wired yet —
// apps/api and apps/web each define their own copies of permission codes for now; consolidating
// them into a compiled runtime package is tracked for a later phase, see docs/ARCHITECTURE.md).

export const GRADE_LEVEL_CODES = [
  'PP1',
  'PP2',
  'G1',
  'G2',
  'G3',
  'G4',
  'G5',
  'G6',
  'G7',
  'G8',
  'G9',
] as const;

export type GradeLevelCode = (typeof GRADE_LEVEL_CODES)[number];

export interface JwtUserPayload {
  sub: string;
  realm: 'platform' | 'tenant';
  email: string;
  fullName: string;
  tenantSchema?: string;
  tenantSlug?: string;
  roles?: string[];
  permissions?: string[];
}
