-- CreateEnum
CREATE TYPE "HamzoneProductLine" AS ENUM ('SCHOOL_ERP', 'DTP_TRAINING', 'CODING_ROBOTICS', 'WEBSITES', 'SACCO_SYSTEMS', 'HOSPITAL_SYSTEMS', 'OTHER');

-- CreateEnum
CREATE TYPE "HamzoneClientType" AS ENUM ('INDIVIDUAL', 'SCHOOL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "HamzoneInvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HamzoneTrainingTrack" AS ENUM ('FRONTEND', 'BACKEND', 'CODING_ROBOTICS', 'OTHER');

-- CreateEnum
CREATE TYPE "HamzoneTrainingStatus" AS ENUM ('ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HamzoneLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "HamzoneDocumentCategory" AS ENUM ('POSTER', 'CERTIFICATE', 'BROCHURE', 'OTHER');

-- CreateTable
CREATE TABLE "HamzoneClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HamzoneClientType" NOT NULL DEFAULT 'INDIVIDUAL',
    "productLines" "HamzoneProductLine"[],
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "systemUrl" TEXT,
    "domainActive" BOOLEAN,
    "nextPaymentDueAt" TIMESTAMP(3),
    "tenantId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HamzoneClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneClientNote" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HamzoneClientNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productLine" "HamzoneProductLine" NOT NULL,
    "description" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "vatRate" INTEGER NOT NULL DEFAULT 16,
    "vatAmount" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "status" "HamzoneInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "smsSentAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HamzoneInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneTrainingRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "traineeName" TEXT NOT NULL,
    "traineeEmail" TEXT,
    "traineePhone" TEXT,
    "track" "HamzoneTrainingTrack" NOT NULL,
    "status" "HamzoneTrainingStatus" NOT NULL DEFAULT 'ENROLLED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HamzoneTrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneMarketingLead" (
    "id" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "interest" "HamzoneProductLine" NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "followUpAt" TIMESTAMP(3),
    "status" "HamzoneLeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HamzoneMarketingLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "HamzoneDocumentCategory" NOT NULL DEFAULT 'OTHER',
    "fileUrl" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HamzoneDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneApiKey" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPreview" TEXT NOT NULL,
    "scopes" TEXT[],
    "createdByUserId" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HamzoneApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HamzoneClientNote_clientId_createdAt_idx" ON "HamzoneClientNote"("clientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HamzoneInvoice_invoiceNumber_key" ON "HamzoneInvoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HamzoneApiKey_keyHash_key" ON "HamzoneApiKey"("keyHash");

-- AddForeignKey
ALTER TABLE "HamzoneClient" ADD CONSTRAINT "HamzoneClient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneClient" ADD CONSTRAINT "HamzoneClient_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneClientNote" ADD CONSTRAINT "HamzoneClientNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "HamzoneClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneClientNote" ADD CONSTRAINT "HamzoneClientNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneInvoice" ADD CONSTRAINT "HamzoneInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "HamzoneClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneInvoice" ADD CONSTRAINT "HamzoneInvoice_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneTrainingRecord" ADD CONSTRAINT "HamzoneTrainingRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "HamzoneClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneTrainingRecord" ADD CONSTRAINT "HamzoneTrainingRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneMarketingLead" ADD CONSTRAINT "HamzoneMarketingLead_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneDocument" ADD CONSTRAINT "HamzoneDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneApiKey" ADD CONSTRAINT "HamzoneApiKey_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

