-- AlterTable
ALTER TABLE "pair_scores" ADD COLUMN     "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[];
