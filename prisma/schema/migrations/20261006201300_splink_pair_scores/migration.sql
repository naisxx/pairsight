-- CreateEnum
CREATE TYPE "ScoreStatus" AS ENUM ('pending', 'running', 'done', 'skipped', 'failed');

-- AlterTable
ALTER TABLE "evaluations" ADD COLUMN     "splinkPicks" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "source_datasets" ADD COLUMN     "scoreClaimedAt" TIMESTAMPTZ(6),
ADD COLUMN     "scoreStatus" "ScoreStatus",
ADD COLUMN     "scoreSummary" JSONB,
ADD COLUMN     "scoredAt" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "pair_scores" (
    "datasetId" UUID NOT NULL,
    "recordAId" UUID NOT NULL,
    "recordBId" UUID NOT NULL,
    "matchWeight" DOUBLE PRECISION NOT NULL,
    "matchProbability" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "pair_scores_pkey" PRIMARY KEY ("datasetId","recordAId","recordBId")
);

-- CreateIndex
CREATE INDEX "pair_scores_datasetId_matchWeight_idx" ON "pair_scores"("datasetId", "matchWeight");

-- CreateIndex
CREATE INDEX "source_datasets_scoreStatus_scoreClaimedAt_idx" ON "source_datasets"("scoreStatus", "scoreClaimedAt");

-- AddForeignKey
ALTER TABLE "pair_scores" ADD CONSTRAINT "pair_scores_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "source_datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
