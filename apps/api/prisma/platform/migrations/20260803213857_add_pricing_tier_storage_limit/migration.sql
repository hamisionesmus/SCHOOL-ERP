-- AlterTable
ALTER TABLE "TenantCreationRequest" ADD COLUMN     "storageLimitMb" INTEGER;

-- AlterTable
ALTER TABLE "PricingTier" ADD COLUMN     "storageLimitMb" INTEGER;

