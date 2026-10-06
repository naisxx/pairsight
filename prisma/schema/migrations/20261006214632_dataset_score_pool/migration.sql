-- DropIndex
DROP INDEX "source_datasets_scoreStatus_scoreClaimedAt_idx";

-- AlterTable
ALTER TABLE "source_datasets" ADD COLUMN     "scorePool" TEXT NOT NULL DEFAULT 'default';

-- CreateIndex
CREATE INDEX "source_datasets_scoreStatus_scorePool_scoreClaimedAt_idx" ON "source_datasets"("scoreStatus", "scorePool", "scoreClaimedAt");
