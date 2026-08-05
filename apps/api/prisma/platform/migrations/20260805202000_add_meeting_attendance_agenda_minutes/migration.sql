-- AlterTable
ALTER TABLE "HamzoneMeeting" ADD COLUMN     "agenda" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "minutes" TEXT,
ADD COLUMN     "minutesUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "minutesUpdatedByUserId" TEXT;

-- CreateTable
CREATE TABLE "HamzoneMeetingAttendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "matched" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HamzoneMeetingAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HamzoneMeetingAttendance_meetingId_email_key" ON "HamzoneMeetingAttendance"("meetingId", "email");

-- AddForeignKey
ALTER TABLE "HamzoneMeeting" ADD CONSTRAINT "HamzoneMeeting_minutesUpdatedByUserId_fkey" FOREIGN KEY ("minutesUpdatedByUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HamzoneMeetingAttendance" ADD CONSTRAINT "HamzoneMeetingAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "HamzoneMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

