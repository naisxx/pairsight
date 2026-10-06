"""Benchmark for the Splink service (services/splink, roadmap item 5).

Scores out/<name>/records.csv (written by export.mts) with the service's own
model, exactly as the run worker would, and writes out/<name>/predictions.parquet
(every pair in the wide net: a, b, match weight) and out/<name>/splink.json
(versions, timings, peak memory). score.py then compares it with our rules.

Usage: services/splink/.venv/Scripts/python scripts/splink-spike/run.py <hard|10k|100k>
"""

import json
import sys
from pathlib import Path

import duckdb
import pandas as pd
import psutil
import splink

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "splink"))
from pairsight_splink.model import score  # noqa: E402

OUT = Path(__file__).parent / "out"
MEMORY_LIMIT = "1500MB"


def main(name: str) -> None:
    records = pd.read_csv(OUT / name / "records.csv", dtype=str, keep_default_na=False)
    scored = score(records, memory_limit=MEMORY_LIMIT)
    scored.pairs.to_parquet(OUT / name / "predictions.parquet", index=False)
    peak = psutil.Process().memory_info().peak_wset if sys.platform == "win32" else None
    report = {
        "dataset": name,
        "splink": splink.__version__,
        "duckdb": duckdb.__version__,
        **scored.summary,
        "peak_memory_mb": None if peak is None else round(peak / 1_000_000),
    }
    (OUT / name / "splink.json").write_text(json.dumps(report, indent=2))
    print(
        f"{name}: {report.get('records')} records, {report.get('pairs_scored')} pairs scored, "
        f"{report.get('seconds_total')} s, peak {report['peak_memory_mb']} MB"
    )


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("hard", "10k", "100k"):
        sys.exit("Usage: run.py <hard|10k|100k>")
    main(sys.argv[1])
