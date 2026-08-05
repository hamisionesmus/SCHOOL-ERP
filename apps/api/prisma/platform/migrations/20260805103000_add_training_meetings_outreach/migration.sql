-- CreateEnum
CREATE TYPE "HamzoneTrainerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "HamzoneProgramStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HamzoneOutreachType" AS ENUM ('ACCOUNT_MANAGEMENT', 'TASKING', 'OUTLIER', 'HANDSHAKE', 'OTHER');

-- CreateEnum
CREATE TYPE "HamzoneOutreachStatus" AS ENUM ('NEW', 'ONBOARDING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "HamzoneEarningPeriod" AS ENUM ('DAILY', 'WEEKLY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlatformRole" ADD VALUE 'TRAINER';
ALTER TYPE "PlatformRole" ADD VALUE 'GIG_WORKER';

-- AlterTable
ALTER TABLE "PlatformUser" ADD COLUMN     "teamTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "HamzoneTrainingRecord" ADD COLUMN     "programId" TEXT;

-- AlterTable
ALTER TABLE "HamzoneDocument" ADD COLUMN     "suggestedByUserId" TEXT,
ADD COLUMN     "trainingProgramId" TEXT;

-- CreateTable
CREATE TABLE "HamzoneTrainingCenter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "headUserId" TEXT,
    "studentsCount" INTEGER,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HamzoneTrainingCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneTrainerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "centerId" TEXT,
    "track" "HamzoneTrainingTrack",
    "monthlySalaryKes" INTEGER,
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "contractDocumentUrl" TEXT,
    "status" "HamzoneTrainerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HamzoneTrainerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneTrainingProgram" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "track" "HamzoneTrainingTrack" NOT NULL,
    "centerId" TEXT,
    "trainerId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "status" "HamzoneProgramStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HamzoneTrainingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneDailyRegister" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "traineesPresent" INTEGER NOT NULL,
    "traineesTotal" INTEGER NOT NULL,
    "topicsCovered" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HamzoneDailyRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneTrainerReport" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "programId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "progressSummary" TEXT NOT NULL,
    "challenges" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HamzoneTrainerReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneMeeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "meetingLink" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "audienceRoles" TEXT[],
    "audienceTeamTags" TEXT[],
    "invitedUserIds" TEXT[],
    "createdByUserId" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HamzoneMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneOutreachEntry" (
    "id" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "type" "HamzoneOutreachType" NOT NULL DEFAULT 'OTHER',
    "status" "HamzoneOutreachStatus" NOT NULL DEFAULT 'NEW',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "loginBrowser" TEXT,
    "assignedToUserId" TEXT,
    "assignedToExternalName" TEXT,
    "assignedToExternalPhone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HamzoneOutreachEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneOutreachEarning" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "period" "HamzoneEarningPeriod" NOT NULL,
    "periodDate" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "challenges" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HamzoneOutreachEarning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HamzoneTrainerProfile_userId_key" ON "HamzoneTrainerProfile"("userId");

-- CreateIndex
CREATE INDEX "HamzoneDailyRegister_programId_date_idx" ON "HamzoneDailyRegister"("programId", "date");

-- AddForeignKey
ALTER TABLE "HamzoneTrainingRecord" ADD CONSTRAINT "HamzoneTrainingRecord_programId_fkey" FOREIGN KEY ("programId") REFERENCES "HamzoneTrainingProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneDocument" ADD CONSTRAINT "HamzoneDocument_trainingProgramId_fkey" FOREIGN KEY ("trainingProgramId") REFERENCES "HamzoneTrainingProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneDocument" ADD CONSTRAINT "HamzoneDocument_suggestedByUserId_fkey" FOREIGN KEY ("suggestedByUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneTrainingCenter" ADD CONSTRAINT "HamzoneTrainingCenter_headUserId_fkey" FOREIGN KEY ("headUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneTrainingCenter" ADD CONSTRAINT "HamzoneTrainingCenter_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneTrainerProfile" ADD CONSTRAINT "HamzoneTrainerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneTrainerProfile" ADD CONSTRAINT "HamzoneTrainerProfile_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "HamzoneTrainingCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneTrainingProgram" ADD CONSTRAINT "HamzoneTrainingProgram_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "HamzoneTrainingCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneTrainingProgram" ADD CONSTRAINT "HamzoneTrainingProgram_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "HamzoneTrainerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneTrainingProgram" ADD CONSTRAINT "HamzoneTrainingProgram_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneDailyRegister" ADD CONSTRAINT "HamzoneDailyRegister_programId_fkey" FOREIGN KEY ("programId") REFERENCES "HamzoneTrainingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneDailyRegister" ADD CONSTRAINT "HamzoneDailyRegister_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "HamzoneTrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneTrainerReport" ADD CONSTRAINT "HamzoneTrainerReport_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "HamzoneTrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneTrainerReport" ADD CONSTRAINT "HamzoneTrainerReport_programId_fkey" FOREIGN KEY ("programId") REFERENCES "HamzoneTrainingProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneMeeting" ADD CONSTRAINT "HamzoneMeeting_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneOutreachEntry" ADD CONSTRAINT "HamzoneOutreachEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneOutreachEntry" ADD CONSTRAINT "HamzoneOutreachEntry_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneOutreachEarning" ADD CONSTRAINT "HamzoneOutreachEarning_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "HamzoneOutreachEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneOutreachEarning" ADD CONSTRAINT "HamzoneOutreachEarning_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

