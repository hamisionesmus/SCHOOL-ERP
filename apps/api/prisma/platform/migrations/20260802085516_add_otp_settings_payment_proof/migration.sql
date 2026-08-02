/*
  Warnings:

  - Added the required column `adminOtpCode` to the `TenantCreationRequest` table without a default value. This is not possible if the table is not empty.
  - Made the column `adminPhone` on table `TenantCreationRequest` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "PaymentProofMethod" AS ENUM ('BANK', 'PAYBILL');

-- CreateEnum
CREATE TYPE "PaymentProofStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "PlatformPaymentMethod" ADD VALUE 'PAYBILL';

-- AlterTable
ALTER TABLE "PlatformUser" ADD COLUMN     "phone" TEXT;

-- AlterTable
-- Existing rows are all historical (already consumed or expired) creation requests — backfilled
-- with placeholders since these two fields didn't exist when they were created and nothing reads
-- them again after consumedAt is set.
ALTER TABLE "TenantCreationRequest" ADD COLUMN     "adminOtpCode" TEXT,
ADD COLUMN     "adminOtpVerifiedAt" TIMESTAMP(3);
UPDATE "TenantCreationRequest" SET "adminOtpCode" = '000000' WHERE "adminOtpCode" IS NULL;
UPDATE "TenantCreationRequest" SET "adminPhone" = 'unknown' WHERE "adminPhone" IS NULL;
ALTER TABLE "TenantCreationRequest" ALTER COLUMN "adminOtpCode" SET NOT NULL,
ALTER COLUMN "adminPhone" SET NOT NULL;

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "paybillNumber" TEXT,
    "paybillAccountName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformPaymentProof" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "method" "PaymentProofMethod" NOT NULL,
    "rawMessage" TEXT NOT NULL,
    "extractedAmount" INTEGER,
    "extractedReference" TEXT,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "PlatformPaymentProof_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlatformPaymentProof" ADD CONSTRAINT "PlatformPaymentProof_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPaymentProof" ADD CONSTRAINT "PlatformPaymentProof_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPaymentProof" ADD CONSTRAINT "PlatformPaymentProof_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
