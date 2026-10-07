# Splink benchmark (roadmap items 5 and 10)

Measures how well the Splink service (`services/splink`) picks pairs for
Jev on fictional people, organisations and
products whose duplicates are known (`scripts/scale/people.mts`,
`companies.mts`, `products.mts`). For products it also counts the variant
traps each side brings up: the same line in another size or colour, which
must not look like a duplicate. No Jev, no database. Run it before changing
the service's models, floors or pinned versions
(docs/rules/splink-service.md); results go in
`docs/PairSight-Scale-Roadmap.md`, items 5 and 10.

```bash
pnpm splink:setup
# for each type (person, company, product) and size (2k, 10k, 100k):
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs scripts/splink-spike/export.mts company 10k
services/splink/.venv/Scripts/python scripts/splink-spike/run.py company-10k    # bin/python on macOS/Linux
services/splink/.venv/Scripts/python scripts/splink-spike/score.py company-10k
```

- `export.mts` writes the records exactly as the app hands them to the
  service, and the answer key (`out/<name>/`).
- `run.py` scores them with the service's own model.
- `score.py` reports duplicates found and pairs to check at each floor.

The comparison rules these were first measured against are gone; their
numbers stay in the roadmap.

The 100K people run peaks at about 5 GB of memory; check you have it free first.
