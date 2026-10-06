"""Which pairs of people are worth checking, scored by Splink on DuckDB.

Splink is the Fellegi-Sunter model trained without labels: it learns how
often real duplicates and unrelated people agree on each field, and scores
every pair inside a wide net. It never decides a match; PairSight's Jev
does (docs/rules/splink-service.md).

The records arrive cleaned by PairSight's own blocking code (the columns in
RECORD_COLUMNS), so Splink and the comparison rules start from the same keys.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import duckdb
import pandas as pd
import splink.comparison_library as cl
from splink import DuckDBAPI, Linker, SettingsCreator, block_on

# The columns PairSight writes (src/server/pairsight/splink/records.ts).
RECORD_COLUMNS = (
    "unique_id",
    "first_name",
    "last_name",
    "full_name",
    "first_dm",
    "surname_dm",
    "name_dm",
    "email",
    "email_local",
    "phone",
    "dob",
    "dob_year",
    "postcode",
    "postcode_district",
    "city",
)

# Fewer records than this give EM too little to learn from: the scores would
# be the library's defaults, not this file's.
MIN_RECORDS = 200
# Fixed so the same file always gives the same pairs.
SEED = 1
# Pairs sampled to learn how often unrelated people agree on each field.
U_SAMPLE_PAIRS = 2_000_000
# How often two random records are the same person, estimated from pairs
# that share an email or a phone, assuming those catch about this share.
DETERMINISTIC_RECALL = 0.7
# A UK postcode's inward code (its last three characters) follows a space.
INWARD_LENGTH = 3


@dataclass
class Scored:
    """Every pair in the wide net with its score, and how the run went."""

    pairs: pd.DataFrame
    summary: dict = field(default_factory=dict)


def _spaced_postcode(value: str | None) -> str | None:
    # Splink's postcode comparison reads the usual spaced form ("SO4 5HQ").
    if value is None or len(value) <= INWARD_LENGTH:
        return value
    return f"{value[:-INWARD_LENGTH]} {value[-INWARD_LENGTH:]}"


def prepare(records: pd.DataFrame) -> pd.DataFrame:
    """The records as Splink reads them: empty values as missing."""
    missing = [column for column in RECORD_COLUMNS if column not in records.columns]
    if missing:
        raise ValueError(f"records are missing columns: {', '.join(missing)}")
    prepared = records.loc[:, list(RECORD_COLUMNS)].astype("object")
    prepared = prepared.where(prepared.notna() & (prepared != ""), None)
    prepared["postcode_spaced"] = prepared["postcode"].map(_spaced_postcode)
    return prepared


# Starting guesses for how often a real duplicate lands in each level, for
# the levels training can't see: a file of a few thousand records may hold no
# swapped names or close spellings inside the training groups, and Splink's
# own fallback then rates them as unlikely as a stranger. Training replaces
# every level it does see. In level order, best first; each adds up to 1.
NAME_M = [
    0.55,  # exact full name
    0.10,  # first and last swapped
    0.10,  # both names very close (Jaro-Winkler >= 0.92)
    0.05,  # both names close (>= 0.88)
    0.10,  # same surname only (a nickname, a new first name)
    0.05,  # same first name only (a new surname)
    0.05,  # neither
]
DOB_M = [
    0.75,  # same date
    0.05,  # one character off (a typo)
    0.03,  # within a month
    0.02,  # within a year
    0.05,  # within ten years
    0.10,  # further apart
]


def settings() -> SettingsCreator:
    return SettingsCreator(
        link_type="dedupe_only",
        unique_id_column_name="unique_id",
        comparisons=[
            # Names: graded similarity, a level for first and last swapped,
            # and term frequency so sharing "Smith" counts for less.
            cl.ForenameSurnameComparison(
                "first_name",
                "last_name",
                forename_surname_concat_col_name="full_name",
            ).configure(m_probabilities=NAME_M),
            cl.DateOfBirthComparison("dob", input_is_string=True).configure(m_probabilities=DOB_M),
            cl.EmailComparison("email"),
            cl.ExactMatch("phone"),
            cl.PostcodeComparison("postcode_spaced"),
            cl.ExactMatch("city").configure(term_frequency_adjustments=True),
        ],
        # The wide net: every pair sharing any of these is scored. What it
        # misses Splink can never find. Surname sound alone was 73M pairs at
        # 100K records (common surnames), so it's narrowed by birth year.
        blocking_rules_to_generate_predictions=[
            block_on("surname_dm", "dob_year"),
            block_on("first_dm", "postcode_district"),
            block_on("email_local"),
            block_on("phone"),
            block_on("dob"),
            block_on("postcode"),
        ],
        retain_intermediate_calculation_columns=False,
    )


# Each EM pass is blocked on something precise (mostly the same person) and
# trains the fields it isn't blocked on. Loose blocks first (same birth date,
# same surname sound) made EM settle on "same family", not "same person".
TRAINING_BLOCKS = (
    ("email_local",),
    ("full_name",),
    ("surname_dm", "dob"),
)


def score(records: pd.DataFrame, memory_limit: str) -> Scored:
    """Trains on the records themselves (no labels) and scores the wide net."""
    prepared = prepare(records)
    if len(prepared) < MIN_RECORDS:
        return Scored(
            pairs=pd.DataFrame(columns=["a", "b", "match_weight", "match_probability"]),
            summary={"skipped": "too_few_records", "records": len(prepared)},
        )

    timings: dict[str, float] = {}

    def timed(label: str, work):
        started = time.perf_counter()
        result = work()
        timings[label] = round(time.perf_counter() - started, 2)
        return result

    connection = duckdb.connect()
    connection.execute(f"SET memory_limit = '{memory_limit}'")
    linker = Linker(prepared, settings(), DuckDBAPI(connection=connection))
    training = linker.training
    timed(
        "prior",
        lambda: training.estimate_probability_two_random_records_match(
            [block_on("email"), block_on("phone")], recall=DETERMINISTIC_RECALL
        ),
    )
    timed(
        "u",
        lambda: training.estimate_u_using_random_sampling(max_pairs=U_SAMPLE_PAIRS, seed=SEED),
    )
    for columns in TRAINING_BLOCKS:
        timed(
            f"em_{'_'.join(columns)}",
            lambda columns=columns: training.estimate_parameters_using_expectation_maximisation(
                block_on(*columns)
            ),
        )
    predictions = timed("predict", lambda: linker.inference.predict().as_pandas_dataframe())

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
            "records": len(prepared),
            "pairs_scored": len(pairs),
            "seconds": timings,
            "seconds_total": round(sum(timings.values()), 2),
        },
    )
