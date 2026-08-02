-- CreateEnum
CREATE TYPE "MpesaStkStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterEnum
ALTER TYPE "TenantStatus" ADD VALUE 'PENDING_PAYMENT';

-- DropForeignKey
ALTER TABLE "PlatformPayment" DROP CONSTRAINT "PlatformPayment_recordedByUserId_fkey";

-- AlterTable
ALTER TABLE "PlatformPayment" ALTER COLUMN "recordedByUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT;

-- AlterTable
ALTER TABLE "TenantCreationRequest" ADD COLUMN     "activationFeeKes" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "PlatformMpesaStkRequest" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "checkoutRequestId" TEXT NOT NULL,
    "merchantRequestId" TEXT,
    "status" "MpesaStkStatus" NOT NULL DEFAULT 'PENDING',
    "mpesaReceiptNumber" TEXT,
    "resultDesc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformMpesaStkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformMpesaStkRequest_checkoutRequestId_key" ON "PlatformMpesaStkRequest"("checkoutRequestId");

-- AddForeignKey
ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformMpesaStkRequest" ADD CONSTRAINT "PlatformMpesaStkRequest_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformMpesaStkRequest" ADD CONSTRAINT "PlatformMpesaStkRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
