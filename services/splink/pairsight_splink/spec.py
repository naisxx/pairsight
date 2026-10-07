"""What one type's model is made of, and the pieces the types share.

Each type PairSight checks (person, company, product) has its own columns,
comparisons, wide net and training passes, in its own module; model.py trains
and scores whichever one a file is for.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass

import pandas as pd
import splink.comparison_level_library as cll
import splink.comparison_library as cl
from splink.internals.blocking_rule_creator import BlockingRuleCreator
from splink.internals.comparison_creator import ComparisonCreator


@dataclass(frozen=True)
class Spec:
    # The columns PairSight writes for the type (src/server/pairsight/splink/records.ts).
    columns: tuple[str, ...]
    comparisons: Callable[[], list[ComparisonCreator]]
    # The wide net: every pair sharing any of these is scored. What it misses
    # can never be found, so it's broad; each rule must stay small at scale.
    wide_net: Callable[[], list[BlockingRuleCreator]]
    # Pairs sharing these are nearly always the same thing; they estimate how
    # often two random records are (DETERMINISTIC_RECALL in model.py).
    prior_blocks: Callable[[], list[BlockingRuleCreator]]
    # Each EM pass is blocked on something precise (mostly real duplicates)
    # and trains the fields it isn't blocked on. Loose blocks teach "same
    # family", not "same thing" (docs/PairSight-Scale-Roadmap.md, item 5).
    training_blocks: tuple[tuple[str, ...], ...]
    # comparison column -> {level: reason code}, for reasons.py.
    level_reasons: Mapping[str, Mapping[int, str]]
    # Columns computed from the written ones, after empty values become None.
    derive: Callable[[pd.DataFrame], pd.DataFrame]


# A UK postcode's inward code (its last three characters) follows a space.
INWARD_LENGTH = 3


def spaced_postcode(value: str | None) -> str | None:
    # Splink's postcode comparison reads the usual spaced form ("SO4 5HQ").
    if value is None or len(value) <= INWARD_LENGTH:
        return value
    return f"{value[:-INWARD_LENGTH]} {value[-INWARD_LENGTH:]}"


def with_spaced_postcode(frame: pd.DataFrame) -> pd.DataFrame:
    frame["postcode_spaced"] = frame["postcode"].map(spaced_postcode)
    return frame


def exact(column: str, m_same: float, *, term_frequency: bool = False) -> ComparisonCreator:
    """Same or not, with a starting guess for how often real duplicates agree.

    The guess covers files whose training groups never see the field filled
    on both sides; training replaces it whenever it can.
    """
    return cl.CustomComparison(
        output_column_name=column,
        comparison_levels=[
            cll.NullLevel(column),
            cll.ExactMatchLevel(column, term_frequency_adjustments=term_frequency).configure(
                m_probability=m_same
            ),
            cll.ElseLevel().configure(m_probability=1 - m_same),
        ],
    )


def held_exact(column: str, m_same: float) -> ComparisonCreator:
    """Same or not, with how often real duplicates agree held fixed.

    For fields where a difference means a different thing (a product's size,
    colour or barcode): left to training, a file full of variants teaches that
    duplicates often differ, and the difference stops counting against; or a
    field that always agrees in training is learned as never differing, so
    one difference outweighs everything else.
    """
    return cl.CustomComparison(
        output_column_name=column,
        comparison_levels=[
            cll.NullLevel(column),
            cll.ExactMatchLevel(column).configure(m_probability=m_same, fix_m_probability=True),
            cll.ElseLevel().configure(m_probability=1 - m_same, fix_m_probability=True),
        ],
    )


# Jaro-Winkler cut-offs for "very close" and "close" names: a typo or a
# dropped letter, and a retyped word.
VERY_CLOSE = 0.92
CLOSE = 0.85
