# Do not add files here by hand

This directory is written only by `scripts/generate-migration.mjs`. For
PairSight that runs locally (`pnpm prisma:migrate:generate <name>`), not in
CI's `migrations` job. See `docs/rules/migrations.md` for the full workflow. (Other repos in the org
use a different, Supabase-CLI based migration workflow — it doesn't apply
to this repo.)

Short version: edit `prisma/schema/*.prisma`, run
`pnpm prisma:migrate:generate <name>` against your local database (which must
have only the committed migrations applied), and commit the generated file
with the schema change. CI re-checks it on the PR. If you ever find yourself about to run
`prisma migrate dev` against a shared database or hand-write a file in this
folder, stop — that's the one thing this workflow exists to prevent.

One-off SQL that isn't a schema change (a data fix, reference rows, a view,
an extension) goes in `prisma/run-once.sql`, not here — the next deploy
applies it once per database and a ledger keeps it from running again. Same
doc, "Run-once SQL".
