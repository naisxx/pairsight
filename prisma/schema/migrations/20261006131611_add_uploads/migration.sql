-- CreateEnum
CREATE TYPE "UploadKind" AS ENUM ('records', 'vendor');

-- AlterTable
ALTER TABLE "source_datasets" ADD COLUMN     "savedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "uploads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID NOT NULL,
    "evaluationId" UUID NOT NULL,
    "kind" "UploadKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uploads_evaluationId_kind_idx" ON "uploads"("evaluationId", "kind");

-- CreateIndex
CREATE INDEX "uploads_createdAt_idx" ON "uploads"("createdAt");

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
