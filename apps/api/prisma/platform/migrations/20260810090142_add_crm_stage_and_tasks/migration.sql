-- CreateEnum
CREATE TYPE "HamzoneClientStage" AS ENUM ('ONBOARDING', 'ACTIVE', 'AT_RISK', 'DORMANT', 'CHURNED');

-- AlterTable
ALTER TABLE "HamzoneClient" ADD COLUMN     "stage" "HamzoneClientStage" NOT NULL DEFAULT 'ONBOARDING';

-- AlterTable
ALTER TABLE "HamzoneMarketingLead" ADD COLUMN     "convertedToClientId" TEXT,
ADD COLUMN     "followUpReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "HamzoneStaffTask" ADD COLUMN     "hamzoneClientId" TEXT,
ADD COLUMN     "hamzoneLeadId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HamzoneMarketingLead_convertedToClientId_key" ON "HamzoneMarketingLead"("convertedToClientId");

-- AddForeignKey
ALTER TABLE "HamzoneMarketingLead" ADD CONSTRAINT "HamzoneMarketingLead_convertedToClientId_fkey" FOREIGN KEY ("convertedToClientId") REFERENCES "HamzoneClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneStaffTask" ADD CONSTRAINT "HamzoneStaffTask_hamzoneClientId_fkey" FOREIGN KEY ("hamzoneClientId") REFERENCES "HamzoneClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneStaffTask" ADD CONSTRAINT "HamzoneStaffTask_hamzoneLeadId_fkey" FOREIGN KEY ("hamzoneLeadId") REFERENCES "HamzoneMarketingLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

