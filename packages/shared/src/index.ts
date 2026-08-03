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

// Kenya's 47 official counties, used to validate/populate the school region dropdown. Actual
// runtime copies live at apps/api/src/common/kenya-counties.ts and
// apps/web/src/lib/kenya-counties.ts (same caveat as GRADE_LEVEL_CODES above — this package isn't
// wired into either app's build yet, so keep all three copies in sync by hand if this list changes).
export const KENYA_COUNTIES = [
  'Mombasa', 'Kwale', 'Kilifi', 'Tana River', 'Lamu', 'Taita-Taveta',
  'Garissa', 'Wajir', 'Mandera', 'Marsabit', 'Isiolo', 'Meru', 'Tharaka-Nithi',
  'Embu', 'Kitui', 'Machakos', 'Makueni', 'Nyandarua', 'Nyeri', 'Kirinyaga',
  "Murang'a", 'Kiambu', 'Turkana', 'West Pokot', 'Samburu', 'Trans Nzoia',
  'Uasin Gishu', 'Elgeyo-Marakwet', 'Nandi', 'Baringo', 'Laikipia', 'Nakuru',
  'Narok', 'Kajiado', 'Kericho', 'Bomet', 'Kakamega', 'Vihiga', 'Bungoma',
  'Busia', 'Siaya', 'Kisumu', 'Homa Bay', 'Migori', 'Kisii', 'Nyamira',
  'Nairobi',
] as const;

export type KenyaCounty = (typeof KENYA_COUNTIES)[number];

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
