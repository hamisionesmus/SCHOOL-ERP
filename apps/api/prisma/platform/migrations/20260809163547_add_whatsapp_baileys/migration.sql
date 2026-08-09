-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "whatsappProvider" TEXT NOT NULL DEFAULT 'BAILEYS';

-- CreateTable
CREATE TABLE "PlatformWhatsAppAuthKey" (
    "keyId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformWhatsAppAuthKey_pkey" PRIMARY KEY ("keyId")
);

-- CreateTable
CREATE TABLE "PlatformWhatsAppSession" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "qrDataUrl" TEXT,
    "connectedPhone" TEXT,
    "lastConnectedAt" TIMESTAMP(3),
    "lastDisconnectedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformWhatsAppSession_pkey" PRIMARY KEY ("id")
);

