-- CreateTable
CREATE TABLE "UserDirectoryEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDirectoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserDirectoryEntry_email_key" ON "UserDirectoryEntry"("email");

-- CreateIndex
CREATE INDEX "UserDirectoryEntry_tenantId_idx" ON "UserDirectoryEntry"("tenantId");

-- AddForeignKey
ALTER TABLE "UserDirectoryEntry" ADD CONSTRAINT "UserDirectoryEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
