# Splink benchmark (roadmap item 5)

Measures how well the Splink service (`services/splink`) picks pairs for
Jev, against our comparison rules, on fictional people whose duplicates are
known. No Jev, no database. Run it before changing the service's model,
floors or pinned versions (docs/rules/splink-service.md); results go in
`docs/PairSight-Scale-Roadmap.md`, item 5.

```bash
pnpm splink:setup
# for each of hard (104 people), 10k, 100k:
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs scripts/splink-spike/export.mts 10k
services/splink/.venv/Scripts/python scripts/splink-spike/run.py 10k    # bin/python on macOS/Linux
services/splink/.venv/Scripts/python scripts/splink-spike/score.py 10k
```

- `export.mts` writes the records exactly as the app hands them to the
  service, the answer key, and how today's rules do (`out/<name>/`).
- `run.py` scores them with the service's own model.
- `score.py` compares both sides by the same yardstick.

The 100K run peaks at about 5 GB of memory; check you have it free first.
