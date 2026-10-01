-- AlterTable
ALTER TABLE "vendor_exports" ADD COLUMN     "stats" JSONB;

-- CreateTable
CREATE TABLE "vendor_drafts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evaluationId" UUID NOT NULL,
    "datasetId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "format" "VendorExportFormat",
    "fileName" TEXT,
    "mapping" JSONB,
    "pairs" JSONB,
    "stats" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_drafts_evaluationId_idx" ON "vendor_drafts"("evaluationId");

-- AddForeignKey
ALTER TABLE "vendor_drafts" ADD CONSTRAINT "vendor_drafts_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_drafts" ADD CONSTRAINT "vendor_drafts_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "source_datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
