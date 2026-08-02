-- AlterEnum
ALTER TYPE "PlatformRole" ADD VALUE 'SUB_ADMIN';

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "advantaApiKey" TEXT,
ADD COLUMN     "advantaPartnerId" TEXT,
ADD COLUMN     "advantaSenderId" TEXT,
ADD COLUMN     "loginTagline" TEXT,
ADD COLUMN     "mpesaCallbackUrl" TEXT,
ADD COLUMN     "mpesaConsumerKey" TEXT,
ADD COLUMN     "mpesaConsumerSecret" TEXT,
ADD COLUMN     "mpesaEnv" TEXT DEFAULT 'sandbox',
ADD COLUMN     "mpesaPasskey" TEXT,
ADD COLUMN     "mpesaShortcode" TEXT,
ADD COLUMN     "resendApiKey" TEXT,
ADD COLUMN     "resendFromAddress" TEXT,
ADD COLUMN     "systemName" TEXT;

-- AddForeignKey
ALTER TABLE "TenantCreationRequest" ADD CONSTRAINT "TenantCreationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
