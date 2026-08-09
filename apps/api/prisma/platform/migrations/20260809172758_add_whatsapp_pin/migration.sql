-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "whatsappPinLockoutMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "whatsappPinMaxAttempts" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "whatsappPinSessionHours" INTEGER NOT NULL DEFAULT 24;

