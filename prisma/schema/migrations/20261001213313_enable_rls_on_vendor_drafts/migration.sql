-- Deny-by-default lock on the new table (docs/rules/auth.md): RLS on, no
-- policies, never FORCE. Prisma connects as the owner, which stays exempt.
ALTER TABLE "vendor_drafts" ENABLE ROW LEVEL SECURITY;
