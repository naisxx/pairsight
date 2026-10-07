# Splink benchmark (roadmap items 5 and 10)

Measures how well the Splink service (`services/splink`) picks pairs for
Jev, against our comparison rules, on fictional people, organisations and
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
  service, the answer key, and how today's rules do (`out/<name>/`).
- `run.py` scores them with the service's own model.
- `score.py` compares both sides by the same yardstick.

The 100K people run peaks at about 5 GB of memory; check you have it free first.
`export.mts person hard` still writes the 104-person hand-made set, which is
now under the service's 200-record minimum.
