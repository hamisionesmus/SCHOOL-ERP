-- AlterTable
ALTER TABLE "PlatformSettings" ALTER COLUMN "mpesaEnv" DROP DEFAULT;

-- Data fix: the old schema default silently wrote the literal string 'sandbox' into every
-- PlatformSettings row the moment it was first created, which permanently defeated the
-- `settings.mpesaEnv || env.MPESA_ENV` fallback in PlatformMpesaService (a non-empty DB value
-- always wins, so it could never fall through to a real MPESA_ENV=production env var). Clear it
-- back to NULL so the env var takes effect again, unless a Super Admin has since explicitly
-- chosen an environment via the API & Payment Config screen.
UPDATE "PlatformSettings" SET "mpesaEnv" = NULL WHERE "mpesaEnv" = 'sandbox';
