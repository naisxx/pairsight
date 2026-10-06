-- AlterTable
ALTER TABLE "run_pairs" ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "searchText" TEXT,
ADD COLUMN     "sortKey" TEXT,
ADD COLUMN     "status" "AssessmentStatus";

-- CreateIndex
CREATE INDEX "run_pairs_runId_score_idx" ON "run_pairs"("runId", "score");
