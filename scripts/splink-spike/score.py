"""Items 5 and 10: how well Splink picks the pairs, on fictional records.

Reads out/<name>/{predictions.parquet, truth.csv, traps.csv, splink.json}
and prints a markdown report (also written to out/<name>/results.md):

- the wide net's ceiling: planted duplicates among every pair Splink scored;
- a sweep of match-weight floors: duplicates found and pairs to check;
- for products, the variant traps (same line, another size or colour) each
  floor lets in: pairs Jev would check and find different;
- which kinds of duplicate the plan's floor finds.

The comparison with the old comparison rules, measured before they were
removed, is in docs/PairSight-Scale-Roadmap.md (items 5 and 10).

Usage: services/splink/.venv/Scripts/python scripts/splink-spike/score.py <type>-<size>
"""

import json
import sys
from pathlib import Path

import pandas as pd

OUT = Path(__file__).parent / "out"
# Match-weight floors for the sweep, high (strict) to low (generous).
FLOORS = [10, 5, 2, 0, -2, -5, -10]
# The plan's floor (src/server/pairsight/splink/picks.ts SPLINK_PLAN_FLOOR).
PLAN_FLOOR = 0
PERCENT = 100


def canonical(left: str, right: str) -> tuple[str, str]:
    # The same order as pairs.ts canonicalPair: plain string comparison.
    return (left, right) if left < right else (right, left)


def pair_keys(path: Path) -> set[tuple[str, str]]:
    if not path.exists():
        return set()
    table = pd.read_csv(path, dtype=str, keep_default_na=False)
    return {canonical(a, b) for a, b in table[["a", "b"]].itertuples(index=False)}


def defect_lines(
    folder: Path, known: dict[tuple[str, str], str], found_keys: set[tuple[str, str]]
) -> list[str]:
    """Item 12: for a --defects export, the planted duplicates with a defect
    on either record, and how many the plan's floor still finds."""
    path = folder / "defects.csv"
    if not path.exists():
        return []
    table = pd.read_csv(path, dtype=str, keep_default_na=False)
    defects: dict[str, set[str]] = {}
    for record, defect in table[["id", "defect"]].itertuples(index=False):
        defects.setdefault(defect, set()).add(record)
    lines = [
        "",
        f"Duplicates touched by a planted defect, at the plan's floor (weight {PLAN_FLOOR}):",
        "",
        "| Defect | Records | Duplicates touched | Found |",
        "| --- | --- | --- | --- |",
    ]
    for defect, records in sorted(defects.items()):
        touched = [key for key in known if key[0] in records or key[1] in records]
        found = sum(1 for key in touched if key in found_keys)
        lines.append(f"| {defect} | {len(records):,} | {len(touched)} | {found} |")
    return lines


def main(name: str) -> None:
    folder = OUT / name
    truth = pd.read_csv(folder / "truth.csv", dtype=str, keep_default_na=False)
    known = {
        canonical(a, b): kind
        for a, b, kind in truth[["a", "b", "kind"]].itertuples(index=False)
    }
    run = json.loads((folder / "splink.json").read_text())
    if "skipped" in run:
        print(
            f"## {name}: skipped by the service ({run['skipped']}, {run['records']} records)"
        )
        return

    predictions = pd.read_parquet(folder / "predictions.parquet")
    predictions["key"] = [
        canonical(left, right)
        for left, right in zip(predictions["a"], predictions["b"], strict=True)
    ]
    predictions["is_duplicate"] = predictions["key"].map(lambda key: key in known)
    traps = pair_keys(folder / "traps.csv")
    predictions["is_trap"] = predictions["key"].map(lambda key: key in traps)
    ranked = predictions.sort_values("match_weight", ascending=False).reset_index(
        drop=True
    )

    def share(found: int) -> str:
        return f"{found}/{len(known)} ({found / len(known) * PERCENT:.1f}%)"

    lines = [
        f"## {name}: {run['records']:,} records, {len(known):,} planted duplicates",
        "",
        f"Splink {run['splink']} on DuckDB {run['duckdb']}: trained and scored in "
        f"{run['seconds_total']} s, peak memory {run['peak_memory_mb']} MB.",
        f"Wide net: {len(ranked):,} pairs scored, holding "
        f"{share(int(ranked['is_duplicate'].sum()))} of the planted duplicates "
        "(the most Splink could find).",
        "",
        "| Match-weight floor | Pairs to check | Duplicates found | Variant traps |",
        "| --- | --- | --- | --- |",
    ]
    for floor in FLOORS:
        kept = ranked[ranked["match_weight"] >= floor]
        lines.append(
            f"| {floor} | {len(kept):,} | {share(int(kept['is_duplicate'].sum()))} | "
            f"{int(kept['is_trap'].sum()):,} of {len(traps):,} |"
        )

    kept = ranked[ranked["match_weight"] >= PLAN_FLOOR]
    found_keys = set(kept.loc[kept["is_duplicate"], "key"])
    lines += [
        "",
        f"By kind, at the plan's floor (weight {PLAN_FLOOR}, {len(kept):,} pairs):",
        "",
        "| Kind | Planted | Found |",
        "| --- | --- | --- |",
    ]
    for kind in sorted(set(known.values())):
        planted = sum(1 for value in known.values() if value == kind)
        found = sum(1 for key in found_keys if known[key] == kind)
        lines.append(f"| {kind} | {planted} | {found} |")

    lines += defect_lines(folder, known, found_keys)
    report = "\n".join(lines) + "\n"
    (folder / "results.md").write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    if len(sys.argv) != 2 or not (OUT / sys.argv[1] / "splink.json").exists():
        sys.exit("Usage: score.py <type>-<size>, after run.py")
    main(sys.argv[1])
