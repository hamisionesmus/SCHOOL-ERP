-- CreateEnum
CREATE TYPE "HamzoneGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "HamzoneJobPositionStatus" AS ENUM ('OPEN', 'CLOSED', 'FILLED');

-- CreateEnum
CREATE TYPE "HamzoneJobApplicationStatus" AS ENUM ('SUBMITTED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'HIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HamzoneStaffTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlatformRole" ADD VALUE 'SOFTWARE_ENGINEER';
ALTER TYPE "PlatformRole" ADD VALUE 'STAFF';

-- AlterTable
ALTER TABLE "PlatformUser" ADD COLUMN     "address" TEXT,
ADD COLUMN     "defaultRole" "PlatformRole",
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "HamzoneClient" ADD COLUMN     "productLinesOther" TEXT;

-- AlterTable
ALTER TABLE "HamzoneTrainingRecord" ADD COLUMN     "trackOther" TEXT;

-- AlterTable
ALTER TABLE "HamzoneMarketingLead" ADD COLUMN     "interestOther" TEXT;

-- AlterTable
ALTER TABLE "HamzoneDocument" ADD COLUMN     "categoryOther" TEXT;

-- AlterTable
ALTER TABLE "HamzoneTrainerProfile" ADD COLUMN     "trackOther" TEXT;

-- AlterTable
ALTER TABLE "HamzoneTrainingProgram" ADD COLUMN     "plannedProjectDescription" TEXT,
ADD COLUMN     "plannedProjectDueAt" TIMESTAMP(3),
ADD COLUMN     "trackOther" TEXT;

-- AlterTable
ALTER TABLE "HamzoneDailyRegister" ADD COLUMN     "hadTrainingToday" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "noTrainingReason" TEXT,
ADD COLUMN     "photo1Url" TEXT,
ADD COLUMN     "photo2Url" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "traineesPresent" SET DEFAULT 0,
ALTER COLUMN "traineesTotal" SET DEFAULT 0,
ALTER COLUMN "topicsCovered" DROP NOT NULL;

-- AlterTable
ALTER TABLE "HamzoneOutreachEntry" ADD COLUMN     "typeOther" TEXT;

-- CreateTable
CREATE TABLE "HamzoneTrainerCenterHistory" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HamzoneTrainerCenterHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneTrainee" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "gender" "HamzoneGender" NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "age" INTEGER,
    "portalEmail" TEXT,
    "portalPasswordHash" TEXT,
    "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HamzoneTrainee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneAttendanceRecord" (
    "id" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL,

    CONSTRAINT "HamzoneAttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneJobPosition" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "roleType" "PlatformRole" NOT NULL,
    "roleTypeOther" TEXT,
    "description" TEXT NOT NULL,
    "requiredPositions" INTEGER NOT NULL,
    "maxApplicants" INTEGER NOT NULL,
    "status" "HamzoneJobPositionStatus" NOT NULL DEFAULT 'OPEN',
    "closesAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HamzoneJobPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneJobApplication" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "experienceSummary" TEXT,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "certificateUrls" TEXT[],
    "coverNote" TEXT,
    "status" "HamzoneJobApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "interviewAt" TIMESTAMP(3),
    "interviewNotes" TEXT,
    "rejectedReason" TEXT,
    "hiredUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HamzoneJobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HamzoneStaffTask" (
    "id" TEXT NOT NULL,
    "assignedToUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "repoUrl" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "HamzoneStaffTaskStatus" NOT NULL DEFAULT 'TODO',
    "assignedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HamzoneStaffTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HamzoneTrainerCenterHistory_trainerId_startDate_idx" ON "HamzoneTrainerCenterHistory"("trainerId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "HamzoneTrainee_portalEmail_key" ON "HamzoneTrainee"("portalEmail");

-- CreateIndex
CREATE INDEX "HamzoneTrainee_programId_idx" ON "HamzoneTrainee"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "HamzoneAttendanceRecord_registerId_traineeId_key" ON "HamzoneAttendanceRecord"("registerId", "traineeId");

-- CreateIndex
CREATE INDEX "HamzoneJobApplication_positionId_status_idx" ON "HamzoneJobApplication"("positionId", "status");

-- CreateIndex
CREATE INDEX "HamzoneStaffTask_assignedToUserId_status_idx" ON "HamzoneStaffTask"("assignedToUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HamzoneDailyRegister_programId_date_key" ON "HamzoneDailyRegister"("programId", "date");

-- AddForeignKey
ALTER TABLE "HamzoneTrainerCenterHistory" ADD CONSTRAINT "HamzoneTrainerCenterHistory_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "HamzoneTrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneTrainerCenterHistory" ADD CONSTRAINT "HamzoneTrainerCenterHistory_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "HamzoneTrainingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneTrainee" ADD CONSTRAINT "HamzoneTrainee_programId_fkey" FOREIGN KEY ("programId") REFERENCES "HamzoneTrainingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneAttendanceRecord" ADD CONSTRAINT "HamzoneAttendanceRecord_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "HamzoneDailyRegister"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneAttendanceRecord" ADD CONSTRAINT "HamzoneAttendanceRecord_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "HamzoneTrainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneJobPosition" ADD CONSTRAINT "HamzoneJobPosition_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneJobApplication" ADD CONSTRAINT "HamzoneJobApplication_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "HamzoneJobPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneJobApplication" ADD CONSTRAINT "HamzoneJobApplication_hiredUserId_fkey" FOREIGN KEY ("hiredUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneStaffTask" ADD CONSTRAINT "HamzoneStaffTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneStaffTask" ADD CONSTRAINT "HamzoneStaffTask_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

