"""Which pairs of records are worth checking, scored by Splink on DuckDB.

Splink is the Fellegi-Sunter model trained without labels: it learns how
often real duplicates and unrelated records agree on each field, and scores
every pair inside a wide net. It never decides a match; PairSight's Jev
does (docs/rules/splink-service.md).

Each type has its own model (person.py, company.py, product.py). The records
arrive cleaned by PairSight's own code (each spec's columns), so Splink and
Jev's comparison view start from the same values.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import duckdb
import pandas as pd
from splink import DuckDBAPI, Linker, SettingsCreator, block_on

from . import company, person, product
from .spec import Spec

SPECS: dict[str, Spec] = {
    "person": person.SPEC,
    "company": company.SPEC,
    "product": product.SPEC,
}
ENTITY_TYPES = tuple(SPECS)

# Fewer records than this give EM too little to learn from: the scores would
# be the library's defaults, not the model's. PairSight refuses smaller files.
MIN_RECORDS = 200
# Fixed so the same file always gives the same pairs.
SEED = 1
# Pairs sampled to learn how often unrelated records agree on each field.
U_SAMPLE_PAIRS = 2_000_000
# How often two random records are the same thing, estimated from pairs that
# share the spec's most precise keys, assuming those catch about this share.
DETERMINISTIC_RECALL = 0.7
# When nothing in the file anchors that estimate (no shared emails or
# phones, say), assume about this share of records has a duplicate: low
# enough that only pairs with real evidence clear the plan's floor.
FALLBACK_DUPLICATE_SHARE = 0.05
# The least share of real duplicates any level may be trained to hold. A file
# of a couple of thousand records gives EM a handful of examples per level,
# and it can learn that duplicates "never" have, say, a swapped name or
# another email (weights of -400 or worse), so one such difference vetoes a
# real duplicate. Floored, a difference counts against, but never alone.
M_FLOOR = 0.05


@dataclass
class Scored:
    """Every pair in the wide net with its score, and how the run went."""

    pairs: pd.DataFrame
    summary: dict = field(default_factory=dict)


def spec_for(entity_type: str) -> Spec:
    if entity_type not in SPECS:
        raise ValueError(f"unknown entity type: {entity_type}")
    return SPECS[entity_type]


def prepare(records: pd.DataFrame, entity_type: str) -> pd.DataFrame:
    """The records as Splink reads them: empty values as missing."""
    spec = spec_for(entity_type)
    missing = [column for column in spec.columns if column not in records.columns]
    if missing:
        raise ValueError(f"records are missing columns: {', '.join(missing)}")
    prepared = records.loc[:, list(spec.columns)].astype("object")
    prepared = prepared.where(prepared.notna() & (prepared != ""), None)
    # As text throughout: a column empty in every row would otherwise reach
    # DuckDB untyped, and be read as a number.
    return spec.derive(prepared).astype("string")


def settings(spec: Spec) -> SettingsCreator:
    return SettingsCreator(
        link_type="dedupe_only",
        unique_id_column_name="unique_id",
        comparisons=spec.comparisons(),
        blocking_rules_to_generate_predictions=spec.wide_net(),
        retain_intermediate_calculation_columns=False,
    )


def floored(model: dict) -> dict:
    """The trained model with every learned m at least M_FLOOR, each
    comparison's m renormalised to add up to 1. Held levels stay as set."""
    for comparison in model["comparisons"]:
        levels = [
            level
            for level in comparison["comparison_levels"]
            if not level.get("is_null_level") and level.get("m_probability") is not None
        ]
        held = sum(level["m_probability"] for level in levels if level.get("fix_m_probability"))
        learned = [level for level in levels if not level.get("fix_m_probability")]
        for level in learned:
            level["m_probability"] = max(level["m_probability"], M_FLOOR)
        total = sum(level["m_probability"] for level in learned)
        if total > 0:
            for level in learned:
                level["m_probability"] *= (1 - held) / total
    return model


def _shares_keys(prepared: pd.DataFrame, columns: tuple[str, ...]) -> bool:
    """Whether any two records have the same values in all these columns."""
    keyed = prepared.dropna(subset=list(columns))
    return bool(keyed.duplicated(subset=list(columns), keep=False).any())


def score(records: pd.DataFrame, entity_type: str, memory_limit: str) -> Scored:
    """Trains on the records themselves (no labels) and scores the wide net."""
    spec = spec_for(entity_type)
    prepared = prepare(records, entity_type)
    if len(prepared) < MIN_RECORDS:
        return Scored(
            pairs=pd.DataFrame(columns=["a", "b", "match_weight", "match_probability"]),
            summary={"skipped": "too_few_records", "records": len(prepared)},
        )

    timings: dict[str, float] = {}
    skipped: list[str] = []

    def timed(label: str, work):
        started = time.perf_counter()
        result = work()
        timings[label] = round(time.perf_counter() - started, 2)
        return result

    connection = duckdb.connect()
    connection.execute(f"SET memory_limit = '{memory_limit}'")
    linker = Linker(prepared, settings(spec), DuckDBAPI(connection=connection))
    training = linker.training
    timed(
        "prior",
        lambda: training.estimate_probability_two_random_records_match(
            spec.prior_blocks(), recall=DETERMINISTIC_RECALL
        ),
    )
    timed(
        "u",
        lambda: training.estimate_u_using_random_sampling(max_pairs=U_SAMPLE_PAIRS, seed=SEED),
    )
    for columns in spec.training_blocks:
        label = f"em_{'_'.join(columns)}"
        # No two records share these keys (the file has no barcodes, say):
        # nothing to learn from this pass, and Splink raises on an empty one
        # only after taking those fields out of the model, so it's never
        # started. The other passes, the starting guesses and M_FLOOR cover
        # what it would have trained.
        if not _shares_keys(prepared, columns):
            skipped.append(label)
            continue
        timed(
            label,
            lambda columns=columns: training.estimate_parameters_using_expectation_maximisation(
                block_on(*columns)
            ),
        )
    model = floored(linker.misc.save_model_to_json())
    prior = model.get("probability_two_random_records_match")
    possible_pairs = len(prepared) * (len(prepared) - 1) / 2
    # Unusable, or more duplicate pairs than there are records: nothing in
    # the file anchored it.
    is_fallback_prior = (
        not isinstance(prior, float) or not 0 < prior < 1 or prior * possible_pairs > len(prepared)
    )
    if is_fallback_prior:
        # n records hold about share × n duplicate pairs among n(n-1)/2.
        model["probability_two_random_records_match"] = (
            2 * FALLBACK_DUPLICATE_SHARE / (len(prepared) - 1)
        )
    trained = Linker(prepared, model, DuckDBAPI(connection=connection))
    predictions = timed("predict", lambda: trained.inference.predict().as_pandas_dataframe())

    pairs = pd.DataFrame(
        {
            "a": predictions["unique_id_l"],
            "b": predictions["unique_id_r"],
            "match_weight": predictions["match_weight"],
            "match_probability": predictions["match_probability"],
            # Each comparison's level for the pair, for its reasons (reasons.py).
            **{
                column: predictions[column]
                for column in predictions.columns
                if column.startswith("gamma_")
            },
        }
    )
    # PairSight's canonical order: the smaller id first, by plain comparison.
    swap = pairs["a"] > pairs["b"]
    pairs.loc[swap, ["a", "b"]] = pairs.loc[swap, ["b", "a"]].to_numpy()
    return Scored(
        pairs=pairs,
        summary={
            "entity_type": entity_type,
            "records": len(prepared),
            "pairs_scored": len(pairs),
            "seconds": timings,
            "seconds_total": round(sum(timings.values()), 2),
            "training_skipped": skipped,
            "fallback_prior": is_fallback_prior,
        },
    )
