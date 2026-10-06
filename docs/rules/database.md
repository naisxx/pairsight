# Database access

All database access goes through the Prisma client (`@/server/db/client`,
exported as `db`). Never query the database any other way — no raw
`pg`/`postgres` clients, no Supabase `.from()`/`.rpc()` calls for data. If
this project also uses Supabase for auth, storage, or realtime, that's fine
— Supabase must never become a second path to the same data Prisma owns.
`$queryRaw` is allowed only where Prisma genuinely cannot express the query,
called out explicitly in the PR description.

This is a hard rule, not a style preference: the org's legacy 8x repo
shipped 147 direct Postgres RPC call sites that TypeScript couldn't see,
and a dropped column silently broke one of them in production. A typed ORM
with zero stored procedures structurally removes that failure class.

Enforced by `eslint.config.mjs`'s `no-restricted-imports`, the same shape as
the icon and AI-SDK rules: `@prisma/client` may be imported as a value only
in `src/server/db/client.ts` (type imports are fine anywhere), and `pg`,
`postgres`, and the other drivers and ORMs have no importer at all. Supabase's
own client can't reach data either — see `docs/rules/auth.md`.
`pnpm check:standards` confirms the rule is in effect.

## Bounded queries

What a page or an API request asks the database for must not grow with the
size of a run, a dataset or a table. A request reads one table filtered by
an indexed key, and reaches other tables only by index lookups for the rows
it returns: a page of 25 pairs joins 25 pairs' records, never every record.

Work over everything (a whole run's counts, every pair's field patterns, a
full download) happens in the background or streams, a chunk at a time
through an index, and its result is stored for requests to read. Copy the
few columns a request filters or sorts on onto the table it reads, refreshed
by that same background step, rather than joining for them per request.

Why: a join over a whole run makes Postgres build hash tables of every pair
and record. It works on small runs and fails at scale, and not as a slow
page: past a few hundred thousand pairs a few such queries at once ran the
database out of shared memory ("could not resize shared memory segment"), and
Results crashed. The local database container has 64 MB; a server has more,
but the work still grows with the data.

How it's enforced: PairSight's request queries are built in one place
(`requestSql` in `src/server/pairsight/results-query.ts`), and
`pnpm scale:check-results` reads each one's plan on the biggest local runs and
fails if judgments or records are read any way but by index lookup. A new
request query goes through `requestSql` so the check sees it. Seed a big run
first with `pnpm scale:seed-run`.
