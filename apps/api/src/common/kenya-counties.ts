// Kenya's 47 official counties — used to server-side-validate Tenant.county. Kept as a plain string
// array (not a Prisma enum) so it can be extended without a migration. Mirror of
// packages/shared/src/index.ts's KENYA_COUNTIES and apps/web/src/lib/kenya-counties.ts — that
// package isn't wired into either app's build yet, so all three copies are kept in sync by hand.
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
