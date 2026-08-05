-- AlterTable
ALTER TABLE "HamzoneMeeting" ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "endedByUserId" TEXT;

-- AlterTable
ALTER TABLE "HamzoneMeetingAttendance" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "HamzoneExternalContact" ADD COLUMN     "position" TEXT;

-- CreateTable
CREATE TABLE "HamzoneMeetingAbsenceReason" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "reason" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HamzoneMeetingAbsenceReason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HamzoneMeetingAbsenceReason_meetingId_email_key" ON "HamzoneMeetingAbsenceReason"("meetingId", "email");

-- AddForeignKey
ALTER TABLE "HamzoneMeeting" ADD CONSTRAINT "HamzoneMeeting_endedByUserId_fkey" FOREIGN KEY ("endedByUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneMeetingAbsenceReason" ADD CONSTRAINT "HamzoneMeetingAbsenceReason_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "HamzoneMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

