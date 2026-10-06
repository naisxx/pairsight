-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "nextTryAt" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "runs" ADD COLUMN     "waitingSince" TIMESTAMPTZ(6);
