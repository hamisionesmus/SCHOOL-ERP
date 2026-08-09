-- AlterTable
ALTER TABLE "User" ADD COLUMN     "whatsappPinChallengeAt" TIMESTAMP(3),
ADD COLUMN     "whatsappPinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "whatsappPinHash" TEXT,
ADD COLUMN     "whatsappPinLockedUntil" TIMESTAMP(3),
ADD COLUMN     "whatsappPinVerifiedAt" TIMESTAMP(3);

