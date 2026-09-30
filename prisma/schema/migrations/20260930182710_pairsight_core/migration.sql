-- CreateEnum
CREATE TYPE "EvaluationKind" AS ENUM ('live', 'demo');

-- CreateEnum
CREATE TYPE "RunOrigin" AS ENUM ('live', 'prepared');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('running', 'completed', 'stopped');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "VendorExportFormat" AS ENUM ('pair', 'group');

-- CreateTable
CREATE TABLE "evaluations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID,
    "name" TEXT NOT NULL,
    "kind" "EvaluationKind" NOT NULL DEFAULT 'live',
    "identitySame" TEXT NOT NULL,
    "identityDifferent" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'US',
    "jevFields" TEXT[],
    "blockingRules" JSONB NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_datasets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evaluationId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "referenceColumn" TEXT NOT NULL,
    "columnRoles" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "datasetId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "values" JSONB NOT NULL,

    CONSTRAINT "source_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_exports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evaluationId" UUID NOT NULL,
    "datasetId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "format" "VendorExportFormat" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "confirmedCompleteAt" TIMESTAMPTZ(6) NOT NULL,
    "pairCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_matches" (
    "exportId" UUID NOT NULL,
    "recordAId" UUID NOT NULL,
    "recordBId" UUID NOT NULL,

    CONSTRAINT "vendor_matches_pkey" PRIMARY KEY ("exportId","recordAId","recordBId")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evaluationId" UUID NOT NULL,
    "datasetId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "origin" "RunOrigin" NOT NULL DEFAULT 'live',
    "status" "RunStatus" NOT NULL DEFAULT 'running',
    "stopReason" TEXT,
    "identitySame" TEXT NOT NULL,
    "identityDifferent" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "jevFields" TEXT[],
    "blockingRules" JSONB NOT NULL,
    "exportIds" TEXT[],
    "judgmentKey" TEXT NOT NULL,
    "jevModel" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "pairCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_pairs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "runId" UUID NOT NULL,
    "recordAId" UUID NOT NULL,
    "recordBId" UUID NOT NULL,
    "ruleIds" TEXT[],
    "matchedByExportIds" TEXT[],
    "assessmentId" UUID NOT NULL,

    CONSTRAINT "run_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "datasetId" UUID NOT NULL,
    "recordAId" UUID NOT NULL,
    "recordBId" UUID NOT NULL,
    "judgmentKey" TEXT NOT NULL,
    "origin" "RunOrigin" NOT NULL DEFAULT 'live',
    "status" "AssessmentStatus" NOT NULL DEFAULT 'pending',
    "score" DOUBLE PRECISION,
    "modelReported" TEXT,
    "requestId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "claimedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluations_ownerId_updatedAt_idx" ON "evaluations"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "source_datasets_evaluationId_createdAt_idx" ON "source_datasets"("evaluationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "source_records_datasetId_reference_key" ON "source_records"("datasetId", "reference");

-- CreateIndex
CREATE INDEX "vendor_exports_evaluationId_idx" ON "vendor_exports"("evaluationId");

-- CreateIndex
CREATE UNIQUE INDEX "runs_evaluationId_number_key" ON "runs"("evaluationId", "number");

-- CreateIndex
CREATE INDEX "run_pairs_assessmentId_idx" ON "run_pairs"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "run_pairs_runId_recordAId_recordBId_key" ON "run_pairs"("runId", "recordAId", "recordBId");

-- CreateIndex
CREATE INDEX "assessments_datasetId_status_idx" ON "assessments"("datasetId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_datasetId_recordAId_recordBId_judgmentKey_key" ON "assessments"("datasetId", "recordAId", "recordBId", "judgmentKey");

-- AddForeignKey
ALTER TABLE "source_datasets" ADD CONSTRAINT "source_datasets_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "source_datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_exports" ADD CONSTRAINT "vendor_exports_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_exports" ADD CONSTRAINT "vendor_exports_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "source_datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_matches" ADD CONSTRAINT "vendor_matches_exportId_fkey" FOREIGN KEY ("exportId") REFERENCES "vendor_exports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "source_datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_pairs" ADD CONSTRAINT "run_pairs_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_pairs" ADD CONSTRAINT "run_pairs_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "source_datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
