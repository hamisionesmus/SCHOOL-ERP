-- CreateEnum
CREATE TYPE "FeedbackContext" AS ENUM ('DEMO_EXPIRY', 'TICKET_RESOLUTION');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TenantCreationRequest" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nonTeachingStaffCount" INTEGER,
ADD COLUMN     "studentCount" INTEGER,
ADD COLUMN     "teacherCount" INTEGER;

-- AlterTable
ALTER TABLE "TenantFeedback" ADD COLUMN     "context" "FeedbackContext" NOT NULL DEFAULT 'DEMO_EXPIRY',
ADD COLUMN     "ticketEscalationId" TEXT;

-- CreateTable
CREATE TABLE "PricingTier" (
    "id" TEXT NOT NULL,
    "minHeadcount" INTEGER NOT NULL,
    "maxHeadcount" INTEGER,
    "priceKes" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingTier_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TenantFeedback" ADD CONSTRAINT "TenantFeedback_ticketEscalationId_fkey" FOREIGN KEY ("ticketEscalationId") REFERENCES "PlatformTicketEscalation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

