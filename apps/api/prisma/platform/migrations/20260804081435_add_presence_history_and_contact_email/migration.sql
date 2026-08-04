-- AlterTable
ALTER TABLE "PlatformUser" ADD COLUMN     "contactEmail" TEXT;

-- CreateTable
CREATE TABLE "PresenceSession" (
    "id" TEXT NOT NULL,
    "realm" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT,
    "roles" JSONB,
    "tenantSlug" TEXT,
    "schoolName" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "PresenceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenceActivity" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresenceActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PresenceSession_connectedAt_idx" ON "PresenceSession"("connectedAt");

-- CreateIndex
CREATE INDEX "PresenceActivity_sessionId_occurredAt_idx" ON "PresenceActivity"("sessionId", "occurredAt");

-- AddForeignKey
ALTER TABLE "PresenceActivity" ADD CONSTRAINT "PresenceActivity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PresenceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

