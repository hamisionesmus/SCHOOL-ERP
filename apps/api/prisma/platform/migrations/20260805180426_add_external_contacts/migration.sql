-- AlterTable
ALTER TABLE "HamzoneMeeting" ADD COLUMN     "externalContactIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "HamzoneExternalContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HamzoneExternalContact_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HamzoneExternalContact" ADD CONSTRAINT "HamzoneExternalContact_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

