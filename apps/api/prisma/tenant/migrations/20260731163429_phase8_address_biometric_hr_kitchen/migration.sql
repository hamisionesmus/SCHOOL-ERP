-- CreateEnum
CREATE TYPE "BiometricSubjectType" AS ENUM ('STUDENT', 'STAFF');

-- CreateEnum
CREATE TYPE "BiometricMethod" AS ENUM ('FACE', 'FINGERPRINT');

-- CreateEnum
CREATE TYPE "BiometricDirection" AS ENUM ('IN', 'OUT');

-- AlterTable
ALTER TABLE "Route" ADD COLUMN     "estimatedMinutes" INTEGER;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "landmark" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "grossPay" INTEGER NOT NULL,
    "deductions" INTEGER NOT NULL DEFAULT 0,
    "netPay" INTEGER NOT NULL,
    "notes" TEXT,
    "issuedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLog" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "tasksDone" TEXT NOT NULL,
    "tasksPending" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricEvent" (
    "id" TEXT NOT NULL,
    "subjectType" "BiometricSubjectType" NOT NULL,
    "studentId" TEXT,
    "staffUserId" TEXT,
    "method" "BiometricMethod" NOT NULL,
    "direction" "BiometricDirection" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loggedByUserId" TEXT NOT NULL,
    "note" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiometricEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_staffUserId_periodMonth_periodYear_key" ON "Payslip"("staffUserId", "periodMonth", "periodYear");

-- CreateIndex
CREATE UNIQUE INDEX "WorkLog_staffUserId_date_key" ON "WorkLog"("staffUserId", "date");

-- CreateIndex
CREATE INDEX "BiometricEvent_studentId_idx" ON "BiometricEvent"("studentId");

-- CreateIndex
CREATE INDEX "BiometricEvent_staffUserId_idx" ON "BiometricEvent"("staffUserId");

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricEvent" ADD CONSTRAINT "BiometricEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricEvent" ADD CONSTRAINT "BiometricEvent_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricEvent" ADD CONSTRAINT "BiometricEvent_loggedByUserId_fkey" FOREIGN KEY ("loggedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
