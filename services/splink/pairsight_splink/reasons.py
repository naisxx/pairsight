"""Why a pair was picked, in codes PairSight turns into plain words.

Each comparison's level for a pair (Splink's gamma columns: -1 missing, 0 no
match, higher is closer) becomes a reason code, or none. The codes are a
contract with PairSight (src/server/pairsight/splink/reasons.ts).
"""

from __future__ import annotations

import pandas as pd

# comparison column -> {level: reason code}. Levels follow model.py's
# comparisons, best first; a level not listed gives no reason.
LEVEL_REASONS: dict[str, dict[int, str]] = {
    "gamma_first_name_last_name": {
        6: "name_same",
        5: "name_swapped",
        4: "name_close",
        3: "name_close",
        2: "surname_same",
        1: "first_name_same",
    },
    "gamma_dob": {5: "dob_same", 4: "dob_close", 3: "dob_close", 2: "dob_close"},
    "gamma_email": {4: "email_same", 3: "email_username", 2: "email_close", 1: "email_close"},
    "gamma_phone": {1: "phone_same"},
    "gamma_postcode_spaced": {4: "postcode_same", 3: "postcode_area", 2: "postcode_area"},
    "gamma_city": {1: "city_same"},
}

SEPARATOR = ";"


def reasons(pairs: pd.DataFrame) -> pd.Series:
    """Each pair's reason codes, joined by SEPARATOR (empty when none)."""
    columns = [column for column in LEVEL_REASONS if column in pairs.columns]
    per_column = [
        pairs[column].map(lambda level, codes=LEVEL_REASONS[column]: codes.get(int(level), ""))
        for column in columns
    ]
    if not per_column:
        return pd.Series([""] * len(pairs), index=pairs.index)
    table = pd.concat(per_column, axis=1)
    return table.apply(lambda row: SEPARATOR.join(code for code in row if code), axis=1)
