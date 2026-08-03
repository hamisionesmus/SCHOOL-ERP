-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "FinanceEntryType" AS ENUM ('IN', 'OUT');

-- AlterEnum
ALTER TYPE "PlatformRole" ADD VALUE 'ASSISTANT_SUPER_ADMIN';

-- AlterTable
ALTER TABLE "PlatformUser" ADD COLUMN     "gender" "Gender";

-- CreateTable
CREATE TABLE "PlatformFinanceEntry" (
    "id" TEXT NOT NULL,
    "type" "FinanceEntryType" NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformFinanceEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlatformFinanceEntry" ADD CONSTRAINT "PlatformFinanceEntry_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

