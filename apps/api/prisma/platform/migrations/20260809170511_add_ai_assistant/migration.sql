-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "aiAssistantEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "anthropicApiKey" TEXT,
ADD COLUMN     "anthropicModel" TEXT;

