"""A small file of fictional people with planted duplicates, for the tests.

Already in the cleaned form PairSight writes (lower case, E.164 phones,
postcodes without spaces), so the tests exercise the service alone.
"""

from __future__ import annotations

import random

import pandas as pd

FIRST = ["ada", "ben", "cara", "dev", "eli", "fay", "gus", "hana", "ian", "jo", "kai", "lena"]
LAST = ["okafor", "smith", "jones", "patel", "khan", "lee", "brown", "taylor", "wilson", "evans"]
AREAS = ["SO4", "BS16", "LS6", "M14", "NE2", "CF10"]


def _person(index: int, pick: random.Random) -> dict[str, str]:
    first, last = pick.choice(FIRST), pick.choice(LAST)
    district = pick.choice(AREAS)
    year = str(pick.randint(1950, 2004))
    return {
        "unique_id": f"P{index:05d}",
        "first_name": first,
        "last_name": last,
        "full_name": f"{first} {last}",
        "first_dm": first[:3].upper(),
        "surname_dm": last[:3].upper(),
        "name_dm": f"{first[:3].upper()} {last[:3].upper()}",
        "email": f"{first}.{last}{index}@example.test",
        "email_local": f"{first}.{last}{index}",
        "phone": f"+447700{900000 + index}",
        "dob": f"{year}-{pick.randint(1, 12):02d}-{pick.randint(1, 28):02d}",
        "dob_year": year,
        "postcode": f"{district}{pick.randint(1, 9)}AB",
        "postcode_district": district,
        "city": district.lower(),
    }


def people(size: int, seed: int = 7) -> tuple[pd.DataFrame, set[tuple[str, str]]]:
    """`size` people; every tenth gets a duplicate sharing its email."""
    pick = random.Random(seed)
    rows: list[dict[str, str]] = []
    duplicates: set[tuple[str, str]] = set()
    while len(rows) < size:
        original = _person(len(rows), pick)
        rows.append(original)
        if len(rows) % 10 == 0 and len(rows) < size:
            copy = {**original, "unique_id": f"P{len(rows):05d}", "phone": "", "postcode": ""}
            rows.append(copy)
            first, second = sorted((original["unique_id"], copy["unique_id"]))
            duplicates.add((first, second))
    return pd.DataFrame(rows), duplicates
