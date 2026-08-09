-- CreateEnum
CREATE TYPE "WhatsAppDirection" AS ENUM ('IN', 'OUT');

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "whatsappAccessToken" TEXT,
ADD COLUMN     "whatsappAppSecret" TEXT,
ADD COLUMN     "whatsappBusinessAccountId" TEXT,
ADD COLUMN     "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "whatsappPhoneNumberId" TEXT,
ADD COLUMN     "whatsappVerifyToken" TEXT;

-- CreateTable
CREATE TABLE "PlatformWhatsAppMessage" (
    "id" TEXT NOT NULL,
    "direction" "WhatsAppDirection" NOT NULL,
    "waId" TEXT NOT NULL,
    "tenantId" TEXT,
    "resolvedUserId" TEXT,
    "body" TEXT NOT NULL,
    "messageId" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformWhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformWhatsAppMessage_messageId_key" ON "PlatformWhatsAppMessage"("messageId");

-- CreateIndex
CREATE INDEX "PlatformWhatsAppMessage_waId_idx" ON "PlatformWhatsAppMessage"("waId");

-- CreateIndex
CREATE INDEX "PlatformWhatsAppMessage_createdAt_idx" ON "PlatformWhatsAppMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "PlatformWhatsAppMessage" ADD CONSTRAINT "PlatformWhatsAppMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

