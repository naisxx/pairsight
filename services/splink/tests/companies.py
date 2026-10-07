"""A small file of fictional organisations with planted duplicates, for the tests.

Already in the cleaned form PairSight writes (lower case, legal suffixes
stripped, E.164 phones, postcodes without spaces, website hosts).
"""

from __future__ import annotations

import random

import pandas as pd

WORDS = ["north", "granite", "harbour", "oak", "bluebell", "copper", "meadow", "falcon", "linden"]
TRADES = ["foods", "logistics", "builders", "media", "supplies", "systems", "health", "energy"]
AREAS = ["SO4", "BS16", "LS6", "M14", "NE2", "CF10"]


def _company(index: int, pick: random.Random) -> dict[str, str]:
    name = f"{pick.choice(WORDS)} {pick.choice(TRADES)} {index}"
    district = pick.choice(AREAS)
    site = name.replace(" ", "")
    return {
        "unique_id": f"C{index:05d}",
        "company_name": name,
        "company_name_dm": " ".join(sorted(word[:3].upper() for word in name.split())),
        "company_name_words": " ".join(sorted(name.split())),
        "trading_name": "",
        "registration_number": f"{10_000_000 + index}",
        "tax_id": f"GB{200_000_000 + index}",
        "website": f"{site}.example.test",
        "email": f"info@{site}.example.test",
        "phone": f"+441134960{index % 1000:03d}",
        "postcode": f"{district}{pick.randint(1, 9)}AB",
        "postcode_district": district,
        "city": district.lower(),
    }


def companies(size: int, seed: int = 7) -> tuple[pd.DataFrame, set[tuple[str, str]]]:
    """`size` organisations; every tenth gets a duplicate sharing its company number."""
    pick = random.Random(seed)
    rows: list[dict[str, str]] = []
    duplicates: set[tuple[str, str]] = set()
    while len(rows) < size:
        original = _company(len(rows), pick)
        rows.append(original)
        if len(rows) % 10 == 0 and len(rows) < size:
            copy = {**original, "unique_id": f"C{len(rows):05d}", "phone": "", "tax_id": ""}
            rows.append(copy)
            first, second = sorted((original["unique_id"], copy["unique_id"]))
            duplicates.add((first, second))
    return pd.DataFrame(rows), duplicates
