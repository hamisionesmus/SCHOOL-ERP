-- CreateEnum
CREATE TYPE "PlatformTicketStatus" AS ENUM ('PENDING', 'ASSIGNED', 'RESOLVED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "county" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "town" TEXT;

-- AlterTable
ALTER TABLE "TenantCreationRequest" ADD COLUMN     "county" TEXT,
ADD COLUMN     "town" TEXT;

-- CreateTable
CREATE TABLE "PlatformNotificationDismissal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notifKey" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformNotificationDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformTicketEscalation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "submitterName" TEXT NOT NULL,
    "escalationReason" TEXT NOT NULL,
    "status" "PlatformTicketStatus" NOT NULL DEFAULT 'PENDING',
    "assignedToId" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformTicketEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformNotificationDismissal_userId_notifKey_key" ON "PlatformNotificationDismissal"("userId", "notifKey");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformNotificationDismissal" ADD CONSTRAINT "PlatformNotificationDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformTicketEscalation" ADD CONSTRAINT "PlatformTicketEscalation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformTicketEscalation" ADD CONSTRAINT "PlatformTicketEscalation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- DataMigration: best-effort backfill of createdById for tenants that predate this column, by
-- matching the originating (consumed) TenantCreationRequest on slug.
UPDATE "Tenant" t
SET "createdById" = tcr."requestedById"
FROM "TenantCreationRequest" tcr
WHERE t."slug" = tcr."slug" AND tcr."consumedAt" IS NOT NULL AND t."createdById" IS NULL;
