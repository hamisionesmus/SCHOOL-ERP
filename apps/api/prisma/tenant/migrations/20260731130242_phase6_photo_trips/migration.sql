-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TripRegistrationStatus" AS ENUM ('UNPAID', 'PAID');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "photoUrl" TEXT;

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "destination" TEXT NOT NULL,
    "tripDate" TIMESTAMP(3) NOT NULL,
    "costPerStudent" INTEGER NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'PROPOSED',
    "proposedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripRegistration" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "TripRegistrationStatus" NOT NULL DEFAULT 'UNPAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripPayment" (
    "id" TEXT NOT NULL,
    "tripRegistrationId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "receivedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripRegistration_tripId_studentId_key" ON "TripRegistration"("tripId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TripPayment_receiptNumber_key" ON "TripPayment"("receiptNumber");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_proposedByUserId_fkey" FOREIGN KEY ("proposedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripRegistration" ADD CONSTRAINT "TripRegistration_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripRegistration" ADD CONSTRAINT "TripRegistration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPayment" ADD CONSTRAINT "TripPayment_tripRegistrationId_fkey" FOREIGN KEY ("tripRegistrationId") REFERENCES "TripRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPayment" ADD CONSTRAINT "TripPayment_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
