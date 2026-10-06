-- Deny-by-default lock on the new table (docs/rules/auth.md): RLS on, no
-- policies, never FORCE. Prisma connects as the owner, which stays exempt.
ALTER TABLE "pair_scores" ENABLE ROW LEVEL SECURITY;
