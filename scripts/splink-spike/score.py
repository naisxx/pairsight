"""Item 5 spike: Splink against today's rules, by the same yardstick.

Reads out/<name>/{predictions.parquet, truth.csv, rules.json, splink.json}
and prints a markdown report (also written to out/<name>/results.md):

- the wide net's ceiling: planted duplicates among every pair Splink scored;
- a sweep of match-weight floors: duplicates found and pairs to check;
- head to head with each rule set: Splink at the same number of pairs, and
  the pairs Splink needs to find as many duplicates.

Usage: services/splink/.venv/Scripts/python scripts/splink-spike/score.py <hard|10k|100k>
"""

import json
import sys
from pathlib import Path

import pandas as pd

OUT = Path(__file__).parent / "out"
# Match-weight floors for the sweep, high (strict) to low (generous).
FLOORS = [10, 5, 2, 0, -2, -5, -10]
PERCENT = 100


def canonical(left: str, right: str) -> tuple[str, str]:
    # The same order as pairs.ts canonicalPair: plain string comparison.
    return (left, right) if left < right else (right, left)


def main(name: str) -> None:
    folder = OUT / name
    truth = pd.read_csv(folder / "truth.csv", dtype=str, keep_default_na=False)
    known = {canonical(a, b): kind for a, b, kind in truth[["a", "b", "kind"]].itertuples(index=False)}
    rules = json.loads((folder / "rules.json").read_text())
    run = json.loads((folder / "splink.json").read_text())
    if "skipped" in run:
        print(f"## {name}: skipped by the service ({run['skipped']}, {run['records']} records)")
        return

    predictions = pd.read_parquet(folder / "predictions.parquet")
    predictions["key"] = [
        canonical(left, right)
        for left, right in zip(predictions["a"], predictions["b"], strict=True)
    ]
    predictions["is_duplicate"] = predictions["key"].map(lambda key: key in known)
    ranked = predictions.sort_values("match_weight", ascending=False).reset_index(drop=True)
    found_by_rank = ranked["is_duplicate"].cumsum()

    def share(found: int) -> str:
        return f"{found}/{len(known)} ({found / len(known) * PERCENT:.1f}%)"

    def found_in_top(count: int) -> int:
        return 0 if count == 0 else int(found_by_rank.iloc[min(count, len(ranked)) - 1])

    def pairs_to_find(target: int) -> int | None:
        reached = found_by_rank[found_by_rank >= target]
        return None if reached.empty else int(reached.index[0]) + 1

    lines = [
        f"## {name}: {run['records']:,} records, {len(known):,} planted duplicates",
        "",
        f"Splink {run['splink']} on DuckDB {run['duckdb']}: trained and scored in "
        f"{run['seconds_total']} s, peak memory {run['peak_memory_mb']} MB.",
        f"Wide net: {len(ranked):,} pairs scored, holding {share(int(ranked['is_duplicate'].sum()))} "
        "of the planted duplicates (the most Splink could find).",
        "",
        "| Match-weight floor | Pairs to check | Duplicates found |",
        "| --- | --- | --- |",
    ]
    for floor in FLOORS:
        kept = ranked[ranked["match_weight"] >= floor]
        lines.append(f"| {floor} | {len(kept):,} | {share(int(kept['is_duplicate'].sum()))} |")

    lines += [
        "",
        "| Today's rules | Pairs | Found | Splink, same pairs | Splink pairs for as many found |",
        "| --- | --- | --- | --- | --- |",
    ]
    for rule_set in rules:
        needed = pairs_to_find(rule_set["found"])
        lines.append(
            f"| {rule_set['label']} | {rule_set['pairs']:,} | {share(rule_set['found'])} | "
            f"{share(found_in_top(rule_set['pairs']))} | "
            f"{'not reached' if needed is None else f'{needed:,}'} |"
        )

    # Which kinds each side misses, at the presets' pair count.
    presets = rules[-1]
    top = ranked.head(presets["pairs"])
    found_keys = set(top.loc[top["is_duplicate"], "key"])
    kinds = sorted(set(known.values()))
    lines += [
        "",
        f"By kind, at {presets['pairs']:,} pairs ({presets['label']} vs Splink):",
        "",
        "| Kind | Planted | Rules found | Splink found |",
        "| --- | --- | --- | --- |",
    ]
    for kind in kinds:
        planted = sum(1 for value in known.values() if value == kind)
        rules_found = planted - presets["missedByKind"].get(kind, 0)
        splink_found = sum(1 for key in found_keys if known[key] == kind)
        lines.append(f"| {kind} | {planted} | {rules_found} | {splink_found} |")

    report = "\n".join(lines) + "\n"
    (folder / "results.md").write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("hard", "10k", "100k"):
        sys.exit("Usage: score.py <hard|10k|100k>")
    main(sys.argv[1])
