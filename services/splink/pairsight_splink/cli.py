"""PairSight's boundary with the Splink service: files in, files out.

    python -m pairsight_splink score --records in.csv --out pairs.csv

Reads the records PairSight wrote, writes the pairs worth keeping (best
first, at or above STORE_FLOOR, at most --max-pairs of them), and prints one
line of JSON on stdout saying how it went. Logs go to stderr as JSON lines.
Exit code 0 means pairs.csv is complete; anything else, ignore it.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import duckdb
import pandas as pd
import splink

from .model import score
from .reasons import reasons

# Pairs scoring below this aren't kept: on the benchmark (scripts/splink-spike/)
# no planted duplicate was found below it, at 10K or 100K records. The Plan's
# own floor (src/server/pairsight/splink/picks.ts) sits higher.
STORE_FLOOR = -10.0
# PairSight checks at most this many pairs in a run (LIMITS.maxPairsPerRun).
DEFAULT_MAX_PAIRS = 100_000
DEFAULT_MEMORY_LIMIT = "1500MB"


class _JsonLines(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({"level": record.levelname.lower(), "message": record.getMessage()})


def _logging() -> None:
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(_JsonLines())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.WARNING)
    # Splink narrates every training step and warns about each level a small
    # file can't train; only its errors are worth PairSight's logs.
    splink_logger = logging.getLogger("splink")
    splink_logger.handlers = []
    splink_logger.setLevel(logging.ERROR)


def run(records_path: Path, out_path: Path, max_pairs: int, memory_limit: str) -> dict:
    records = pd.read_csv(records_path, dtype=str, keep_default_na=False)
    scored = score(records, memory_limit=memory_limit)
    kept = (
        scored.pairs[scored.pairs["match_weight"] >= STORE_FLOOR]
        .sort_values("match_weight", ascending=False)
        .head(max_pairs)
    )
    kept = kept.assign(reasons=reasons(kept))[
        ["a", "b", "match_weight", "match_probability", "reasons"]
    ]
    kept.to_csv(out_path, index=False)
    return {
        **scored.summary,
        "pairs_kept": len(kept),
        "store_floor": STORE_FLOOR,
        "splink": splink.__version__,
        "duckdb": duckdb.__version__,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="pairsight_splink")
    commands = parser.add_subparsers(dest="command", required=True)
    score_command = commands.add_parser("score", help="score the pairs in a file of records")
    score_command.add_argument("--records", type=Path, required=True)
    score_command.add_argument("--out", type=Path, required=True)
    score_command.add_argument("--max-pairs", type=int, default=DEFAULT_MAX_PAIRS)
    score_command.add_argument("--memory-limit", default=DEFAULT_MEMORY_LIMIT)
    args = parser.parse_args(argv)

    _logging()
    summary = run(args.records, args.out, args.max_pairs, args.memory_limit)
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
