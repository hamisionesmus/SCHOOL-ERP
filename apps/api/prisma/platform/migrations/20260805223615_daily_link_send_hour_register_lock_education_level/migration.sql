-- AlterTable
ALTER TABLE "HamzoneTrainingProgram" ADD COLUMN     "dailyLinkLastSentDateKey" TEXT,
ADD COLUMN     "dailyLinkSendHour" INTEGER;

-- AlterTable
ALTER TABLE "HamzoneDailyRegister" ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "HamzoneTrainee" ADD COLUMN     "educationLevel" TEXT;

