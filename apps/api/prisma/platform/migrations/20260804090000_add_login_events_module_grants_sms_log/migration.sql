-- AlterTable
ALTER TABLE "FailedLoginAttempt" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT;

-- CreateTable
CREATE TABLE "LoginEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "realm" TEXT NOT NULL,
    "tenantSlug" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "city" TEXT,
    "country" TEXT,
    "isNewDevice" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAdminModuleGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAdminModuleGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSmsLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginEvent_userId_createdAt_idx" ON "LoginEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAdminModuleGrant_userId_module_key" ON "PlatformAdminModuleGrant"("userId", "module");

-- CreateIndex
CREATE INDEX "PlatformSmsLog_createdAt_idx" ON "PlatformSmsLog"("createdAt");

-- AddForeignKey
ALTER TABLE "PlatformAdminModuleGrant" ADD CONSTRAINT "PlatformAdminModuleGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

