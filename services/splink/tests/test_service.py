import json

import pandas as pd
import pytest

from pairsight_splink.cli import STORE_FLOOR, main
from pairsight_splink.model import MIN_RECORDS, RECORD_COLUMNS, prepare, score

from .people import people

MEMORY = "500MB"


def test_records_must_carry_every_column():
    without_email = [column for column in RECORD_COLUMNS if column != "email"]
    with pytest.raises(ValueError, match="missing columns: email"):
        prepare(pd.DataFrame({column: ["x"] for column in without_email}))


def test_empty_values_are_missing_and_postcodes_get_their_space():
    records, _ = people(3)
    records.loc[0, "phone"] = ""
    prepared = prepare(records)
    assert prepared.loc[0, "phone"] is None
    assert prepared.loc[1, "postcode_spaced"].endswith(" " + records.loc[1, "postcode"][-3:])


def test_too_few_records_are_skipped_with_the_reason():
    records, _ = people(MIN_RECORDS - 1)
    scored = score(records, memory_limit=MEMORY)
    assert scored.summary == {"skipped": "too_few_records", "records": MIN_RECORDS - 1}
    assert scored.pairs.empty


def test_planted_duplicates_score_high_and_pairs_are_in_canonical_order():
    records, duplicates = people(600)
    scored = score(records, memory_limit=MEMORY)
    pairs = scored.pairs
    assert (pairs["a"] < pairs["b"]).all()
    found = pairs[[(a, b) in duplicates for a, b in zip(pairs["a"], pairs["b"], strict=True)]]
    assert len(found) == len(duplicates)
    # Every planted duplicate outranks almost every other pair.
    assert found["match_weight"].min() > pairs["match_weight"].quantile(0.9)


def test_the_cli_writes_the_kept_pairs_best_first_and_says_how_it_went(tmp_path, capsys):
    records, duplicates = people(600)
    records.to_csv(tmp_path / "records.csv", index=False)
    assert (
        main(
            [
                "score",
                "--records",
                str(tmp_path / "records.csv"),
                "--out",
                str(tmp_path / "pairs.csv"),
                "--max-pairs",
                "5000",
                "--memory-limit",
                MEMORY,
            ]
        )
        == 0
    )
    summary = json.loads(capsys.readouterr().out)
    pairs = pd.read_csv(tmp_path / "pairs.csv", dtype={"a": str, "b": str})
    assert list(pairs.columns) == ["a", "b", "match_weight", "match_probability"]
    assert (pairs["match_weight"] >= STORE_FLOOR).all()
    assert pairs["match_weight"].is_monotonic_decreasing
    assert summary["records"] == len(records)
    assert summary["pairs_kept"] == len(pairs)
    assert {"splink", "duckdb", "seconds", "pairs_scored"} <= summary.keys()
    kept = set(zip(pairs["a"], pairs["b"], strict=True))
    assert duplicates <= kept


def test_the_same_file_always_gives_the_same_pairs():
    records, _ = people(400)
    first = score(records, memory_limit=MEMORY).pairs.sort_values(["a", "b"]).reset_index(drop=True)
    second = (
        score(records, memory_limit=MEMORY).pairs.sort_values(["a", "b"]).reset_index(drop=True)
    )
    pd.testing.assert_frame_equal(first, second)
