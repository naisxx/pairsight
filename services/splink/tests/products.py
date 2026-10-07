"""A small file of fictional products with planted duplicates and variants.

Already in the cleaned form PairSight writes (lower case, 14-digit GTINs,
part numbers as upper-case letters and digits). Every product comes in two
sizes: the other size is a variant, a different product, not a duplicate.
"""

from __future__ import annotations

import random

import pandas as pd

BRANDS = ["brightwell", "corvane", "dunmore", "halden", "everlyn", "glowmark"]
LINES = ["nova", "aria", "terra", "lumen", "vela", "orra", "sola", "kite"]
KINDS = ["kettle", "toaster", "lamp", "speaker", "fan", "blender"]
SIZES = ["small", "large"]
COLORS = ["black", "white", "red"]


def _product(index: int, family: int, size: str, pick: random.Random) -> dict[str, str]:
    name = f"{LINES[family % len(LINES)]} {KINDS[family % len(KINDS)]} {family}"
    brand = BRANDS[family % len(BRANDS)]
    return {
        "unique_id": f"G{index:05d}",
        "product_name": name,
        "product_name_prefix": name.replace(" ", "")[:4],
        "product_name_words": " ".join(sorted(name.split())),
        "brand": brand,
        "manufacturer": f"{brand} group",
        "gtin": f"{50_000_000_000_000 + index:014d}",
        "mpn": f"{brand[:3].upper()}{family:04d}{size[0].upper()}",
        "sku": f"SKU{900_000 + index}",
        "model_number": "",
        "category": KINDS[family % len(KINDS)],
        "color": pick.choice(COLORS),
        "size": size,
    }


def products(
    size: int, seed: int = 7
) -> tuple[pd.DataFrame, set[tuple[str, str]], set[tuple[str, str]]]:
    """`size` products in families of two sizes; every fifth family gets a
    duplicate of its first size sharing the barcode. Also returns the
    variant pairs (same family, other size), which must not look the same."""
    pick = random.Random(seed)
    rows: list[dict[str, str]] = []
    duplicates: set[tuple[str, str]] = set()
    variants: set[tuple[str, str]] = set()
    family = 0
    while len(rows) < size:
        first = _product(len(rows), family, SIZES[0], pick)
        rows.append(first)
        second = _product(len(rows), family, SIZES[1], pick)
        rows.append(second)
        variants.add(tuple(sorted((first["unique_id"], second["unique_id"]))))
        if family % 5 == 0:
            copy = {**first, "unique_id": f"G{len(rows):05d}", "sku": "", "manufacturer": ""}
            rows.append(copy)
            duplicates.add(tuple(sorted((first["unique_id"], copy["unique_id"]))))
            variants.add(tuple(sorted((second["unique_id"], copy["unique_id"]))))
        family += 1
    return pd.DataFrame(rows), duplicates, variants
