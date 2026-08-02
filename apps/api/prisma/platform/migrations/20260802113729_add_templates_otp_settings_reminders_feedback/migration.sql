-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "bankTransferEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "demoReminderDaysBefore" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "paybillEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "renewalReminderDaysBefore" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "stkEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "demoReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "renewalReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TenantCreationRequest" ADD COLUMN     "activationBillingCycle" "BillingCycle";

-- CreateTable
CREATE TABLE "PlatformMessageTemplate" (
    "key" TEXT NOT NULL,
    "subject" TEXT,
    "emailBody" TEXT,
    "smsBody" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformMessageTemplate_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PlatformSettingsChangeRequest" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSettingsChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantFeedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rating" INTEGER,
    "improvements" TEXT,
    "interestedInRealAccount" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantFeedback_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlatformSettingsChangeRequest" ADD CONSTRAINT "PlatformSettingsChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFeedback" ADD CONSTRAINT "TenantFeedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
