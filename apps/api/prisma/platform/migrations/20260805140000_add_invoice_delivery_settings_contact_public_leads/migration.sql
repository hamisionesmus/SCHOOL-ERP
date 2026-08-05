-- CreateEnum
CREATE TYPE "HamzoneLeadSource" AS ENUM ('ADMIN', 'PUBLIC_API');

-- DropForeignKey
ALTER TABLE "HamzoneMarketingLead" DROP CONSTRAINT "HamzoneMarketingLead_submittedByUserId_fkey";

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "supportPhone" TEXT,
ADD COLUMN     "supportWebsite" TEXT;

-- AlterTable
ALTER TABLE "HamzoneInvoice" ADD COLUMN     "emailError" TEXT,
ADD COLUMN     "emailStatus" "CampaignDeliveryStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "smsError" TEXT,
ADD COLUMN     "smsStatus" "CampaignDeliveryStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "HamzoneMarketingLead" ADD COLUMN     "source" "HamzoneLeadSource" NOT NULL DEFAULT 'ADMIN',
ALTER COLUMN "submittedByUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "HamzoneMarketingLead" ADD CONSTRAINT "HamzoneMarketingLead_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

