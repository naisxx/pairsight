-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('person', 'company', 'product');

-- AlterTable
ALTER TABLE "evaluations" ADD COLUMN     "entityType" "EntityType";

-- AlterTable
ALTER TABLE "runs" ADD COLUMN     "entityType" "EntityType" NOT NULL DEFAULT 'person';
