-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "demoExpiresAt" TIMESTAMP(3),
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "settingsConfigured" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TenantCreationRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "adminFullName" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "adminPasswordHash" TEXT NOT NULL,
    "planId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "demoDurationHours" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantCreationRequest_pkey" PRIMARY KEY ("id")
);
