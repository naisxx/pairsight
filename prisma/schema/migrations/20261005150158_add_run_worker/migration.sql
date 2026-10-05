-- AlterTable
ALTER TABLE "runs" ADD COLUMN     "workerPool" TEXT NOT NULL DEFAULT 'default';

-- CreateIndex
CREATE INDEX "assessments_status_claimedAt_idx" ON "assessments"("status", "claimedAt");

-- CreateIndex
CREATE INDEX "runs_status_workerPool_idx" ON "runs"("status", "workerPool");
