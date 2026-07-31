-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PlatformInvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlatformPaymentMethod" AS ENUM ('BANK', 'MPESA', 'CASH');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlatformInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PlatformInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformPayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PlatformPaymentMethod" NOT NULL,
    "reference" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInvoice_invoiceNumber_key" ON "PlatformInvoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformPayment_receiptNumber_key" ON "PlatformPayment"("receiptNumber");

-- AddForeignKey
ALTER TABLE "PlatformInvoice" ADD CONSTRAINT "PlatformInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
