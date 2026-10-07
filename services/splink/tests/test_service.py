import json

import pandas as pd
import pytest

from pairsight_splink.cli import STORE_FLOOR, main
from pairsight_splink.model import ENTITY_TYPES, MIN_RECORDS, prepare, score, spec_for
from pairsight_splink.reasons import reasons

from .companies import companies
from .people import people
from .products import products

MEMORY = "500MB"


def planted(entity_type: str, size: int) -> tuple[pd.DataFrame, set[tuple[str, str]]]:
    """A file of the type with its planted duplicates."""
    if entity_type == "company":
        return companies(size)
    if entity_type == "product":
        records, duplicates, _ = products(size)
        return records, duplicates
    return people(size)


# What every planted duplicate shares, by type (see each generator).
PLANTED_REASONS = {
    "person": {"email_same", "name_same"},
    "company": {"registration_same", "name_same", "website_same"},
    "product": {"gtin_same", "name_same", "brand_same"},
}


def found(pairs: pd.DataFrame, keys: set[tuple[str, str]]) -> pd.DataFrame:
    return pairs[[(a, b) in keys for a, b in zip(pairs["a"], pairs["b"], strict=True)]]


def score_with_cli(tmp_path, capsys, entity_type: str, records: pd.DataFrame, *extra: str):
    records.to_csv(tmp_path / "records.csv", index=False)
    code = main(
        [
            "score",
            "--entity-type",
            entity_type,
            "--records",
            str(tmp_path / "records.csv"),
            "--out",
            str(tmp_path / "pairs.csv"),
            "--memory-limit",
            MEMORY,
            *extra,
        ]
    )
    summary = json.loads(capsys.readouterr().out)
    pairs = pd.read_csv(tmp_path / "pairs.csv", dtype=str, keep_default_na=False)
    return code, summary, pairs


@pytest.mark.parametrize("entity_type", ENTITY_TYPES)
def test_records_must_carry_every_column(entity_type):
    columns = spec_for(entity_type).columns
    dropped = columns[1]
    with pytest.raises(ValueError, match=f"missing columns: {dropped}"):
        prepare(
            pd.DataFrame({column: ["x"] for column in columns if column != dropped}), entity_type
        )


def test_an_unknown_type_is_refused():
    with pytest.raises(ValueError, match="unknown entity type"):
        spec_for("planet")


def test_empty_values_are_missing_and_postcodes_get_their_space():
    records, _ = people(3)
    records.loc[0, "phone"] = ""
    prepared = prepare(records, "person")
    assert pd.isna(prepared.loc[0, "phone"])
    assert prepared.loc[1, "postcode_spaced"].endswith(" " + records.loc[1, "postcode"][-3:])


def test_sizes_and_colours_compare_without_spacing_or_case():
    records, _, _ = products(3)
    records.loc[0, "size"] = "1.7 L"
    records.loc[1, "size"] = "1.7l"
    prepared = prepare(records, "product")
    assert prepared.loc[0, "size_key"] == prepared.loc[1, "size_key"] == "17l"


@pytest.mark.parametrize("entity_type", ENTITY_TYPES)
def test_too_few_records_are_skipped_with_the_reason(entity_type):
    records, _ = planted(entity_type, MIN_RECORDS + 10)
    records = records.head(MIN_RECORDS - 1)
    scored = score(records, entity_type=entity_type, memory_limit=MEMORY)
    assert scored.summary == {"skipped": "too_few_records", "records": MIN_RECORDS - 1}
    assert scored.pairs.empty


@pytest.mark.parametrize("entity_type", ENTITY_TYPES)
def test_planted_duplicates_score_high_and_pairs_are_in_canonical_order(entity_type):
    records, duplicates = planted(entity_type, 600)
    pairs = score(records, entity_type=entity_type, memory_limit=MEMORY).pairs
    assert (pairs["a"] < pairs["b"]).all()
    hits = found(pairs, duplicates)
    assert len(hits) == len(duplicates)
    # Every planted duplicate outranks almost every other pair.
    assert hits["match_weight"].min() > pairs["match_weight"].quantile(0.9)


def test_a_different_size_counts_against_a_product():
    records, duplicates, variants = products(600)
    pairs = score(records, entity_type="product", memory_limit=MEMORY).pairs
    # Same name, brand and category, but another size: below every duplicate.
    assert (
        found(pairs, variants)["match_weight"].max()
        < found(pairs, duplicates)["match_weight"].min()
    )


@pytest.mark.parametrize("entity_type", ENTITY_TYPES)
def test_the_cli_writes_the_kept_pairs_best_first_and_says_how_it_went(
    tmp_path, capsys, entity_type
):
    records, duplicates = planted(entity_type, 600)
    code, summary, pairs = score_with_cli(
        tmp_path, capsys, entity_type, records, "--max-pairs", "5000"
    )
    assert code == 0
    assert list(pairs.columns) == ["a", "b", "match_weight", "match_probability", "reasons"]
    weights = pairs["match_weight"].astype(float)
    assert (weights >= STORE_FLOOR).all()
    assert weights.is_monotonic_decreasing
    assert summary["records"] == len(records)
    assert summary["entity_type"] == entity_type
    assert summary["pairs_kept"] == len(pairs)
    assert {"splink", "duckdb", "seconds", "pairs_scored"} <= summary.keys()
    assert duplicates <= set(zip(pairs["a"], pairs["b"], strict=True))


@pytest.mark.parametrize("entity_type", ENTITY_TYPES)
def test_the_same_file_always_gives_the_same_pairs(entity_type):
    records, _ = planted(entity_type, 400)

    def ranked():
        pairs = score(records, entity_type=entity_type, memory_limit=MEMORY).pairs
        return pairs.sort_values(["a", "b"]).reset_index(drop=True)

    pd.testing.assert_frame_equal(ranked(), ranked())


def test_each_pair_carries_its_reasons_in_codes():
    frame = pd.DataFrame(
        {
            "gamma_first_name_last_name": [5, 6, 0],
            "gamma_dob": [5, -1, 2],
            "gamma_email": [0, 4, 3],
            "gamma_phone": [-1, 1, 0],
            "gamma_postcode_spaced": [2, 4, -1],
            "gamma_city": [1, 0, 0],
        }
    )
    assert list(reasons(frame, spec_for("person").level_reasons)) == [
        "name_swapped;dob_same;postcode_area;city_same",
        "name_same;email_same;phone_same;postcode_same",
        "dob_close;email_username",
    ]


@pytest.mark.parametrize("entity_type", ENTITY_TYPES)
def test_every_level_reason_is_a_known_code(entity_type):
    # The codes PairSight knows (src/server/pairsight/splink/reasons.ts).
    known = {
        *("name_same", "name_swapped", "name_close", "surname_same", "first_name_same"),
        *("dob_same", "dob_close", "email_same", "email_username", "email_close"),
        *("phone_same", "postcode_same", "postcode_area", "city_same", "trading_name_same"),
        *("registration_same", "tax_id_same", "website_same", "gtin_same", "mpn_same"),
        *("sku_same", "brand_same", "brand_close", "manufacturer_same"),
        *("size_same", "color_same"),
    }
    codes = {
        code for levels in spec_for(entity_type).level_reasons.values() for code in levels.values()
    }
    assert codes <= known


@pytest.mark.parametrize("entity_type", ENTITY_TYPES)
def test_planted_duplicates_are_explained(tmp_path, capsys, entity_type):
    records, duplicates = planted(entity_type, 600)
    _, _, pairs = score_with_cli(tmp_path, capsys, entity_type, records)
    for codes in found(pairs, duplicates)["reasons"]:
        assert PLANTED_REASONS[entity_type] <= set(codes.split(";"))
