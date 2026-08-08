-- AlterTable
ALTER TABLE "HamzoneTrainee" ADD COLUMN     "traineeNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HamzoneTrainee_traineeNumber_key" ON "HamzoneTrainee"("traineeNumber");

