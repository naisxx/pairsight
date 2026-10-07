-- PairSight picks every pair itself now (Scale Roadmap item 10): the
-- hand-written comparison rules and the switch for suggestions go.
-- Hand-written (the destructive-change exception, docs/rules/migrations.md)
-- so each run pair keeps where it came from before its rule ids are dropped.

-- AlterTable
ALTER TABLE "run_pairs" ADD COLUMN "isSuggested" BOOLEAN NOT NULL DEFAULT false;

-- A pair picked by a rule or a suggestion was picked by PairSight; one with
-- no rule ids was added only because a vendor matched it.
UPDATE "run_pairs" SET "isSuggested" = true WHERE cardinality("ruleIds") > 0;

-- AlterTable
ALTER TABLE "run_pairs" DROP COLUMN "ruleIds";

-- AlterTable
ALTER TABLE "evaluations" DROP COLUMN "blockingRules",
DROP COLUMN "splinkPicks";

-- AlterTable
ALTER TABLE "runs" DROP COLUMN "blockingRules";
