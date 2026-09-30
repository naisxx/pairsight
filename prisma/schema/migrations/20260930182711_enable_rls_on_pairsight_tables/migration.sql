-- Row Level Security on every PairSight table, enabled with no policies and
-- never FORCEd: a deny-by-default lock for any anon/authenticated role, while
-- Prisma (the table owner) stays exempt. Hand-written on purpose — RLS is not
-- expressible in the Prisma schema (docs/rules/auth.md) — and checked by
-- `pnpm check:rls`.
ALTER TABLE "evaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "source_datasets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "source_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendor_exports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendor_matches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "run_pairs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assessments" ENABLE ROW LEVEL SECURITY;
