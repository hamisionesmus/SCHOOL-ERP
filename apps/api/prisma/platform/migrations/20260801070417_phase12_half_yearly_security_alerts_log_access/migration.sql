-- CreateEnum
CREATE TYPE "SecurityAlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterEnum
ALTER TYPE "BillingCycle" ADD VALUE 'HALF_YEARLY';

-- CreateTable
CREATE TABLE "FailedLoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tenantSlug" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailedLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "SecurityAlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "email" TEXT,
    "tenantSlug" TEXT,
    "ipAddress" TEXT,
    "attemptCount" INTEGER,
    "details" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLogAccessRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeExpiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "availableAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),
    "sharedWithSchoolAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FailedLoginAttempt_email_tenantSlug_createdAt_idx" ON "FailedLoginAttempt"("email", "tenantSlug", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLogAccessRequest" ADD CONSTRAINT "AuditLogAccessRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogAccessRequest" ADD CONSTRAINT "AuditLogAccessRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
