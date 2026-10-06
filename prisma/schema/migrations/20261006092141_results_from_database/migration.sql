-- AlterTable
ALTER TABLE "runs" ADD COLUMN     "summary" JSONB,
ADD COLUMN     "summaryVersion" INTEGER;

-- AlterTable
ALTER TABLE "source_records" ADD COLUMN     "label" TEXT,
ADD COLUMN     "searchText" TEXT,
ADD COLUMN     "sortKey" TEXT;

-- CreateIndex
CREATE INDEX "source_records_datasetId_sortKey_idx" ON "source_records"("datasetId", "sortKey");
