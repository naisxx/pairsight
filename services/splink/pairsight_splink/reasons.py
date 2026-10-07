"""Why a pair was picked, in codes PairSight turns into plain words.

Each comparison's level for a pair (Splink's gamma columns: -1 missing, 0 no
match, higher is closer) becomes a reason code, or none, by its type's
`level_reasons` (person.py, company.py, product.py). The codes are a contract
with PairSight (src/server/pairsight/splink/reasons.ts).
"""

from __future__ import annotations

from collections.abc import Mapping

import pandas as pd

SEPARATOR = ";"


def reasons(pairs: pd.DataFrame, level_reasons: Mapping[str, Mapping[int, str]]) -> pd.Series:
    """Each pair's reason codes, joined by SEPARATOR (empty when none)."""
    columns = [column for column in level_reasons if column in pairs.columns]
    per_column = [
        pairs[column].map(lambda level, codes=level_reasons[column]: codes.get(int(level), ""))
        for column in columns
    ]
    if not per_column:
        return pd.Series([""] * len(pairs), index=pairs.index)
    table = pd.concat(per_column, axis=1)
    return table.apply(lambda row: SEPARATOR.join(code for code in row if code), axis=1)
