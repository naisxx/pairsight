"""The model for products: barcodes, part numbers, names, brands and variants.

A different size or colour is a different product (Jev's "same product"
question), and a product's variants share everything else: its name, brand,
category and often its model number. So size, colour and barcode hold their
weights (spec.held_exact) rather than learn them from a file full of
variants, and the model number only brings pairs into the net: agreeing on
it says "same line", not "same product".
"""

from __future__ import annotations

import re

import pandas as pd
import splink.comparison_level_library as cll
import splink.comparison_library as cl
from splink import block_on

from .spec import CLOSE, VERY_CLOSE, Spec, exact, held_exact

COLUMNS = (
    "unique_id",
    "product_name",
    "product_name_prefix",
    "product_name_words",
    "brand",
    "manufacturer",
    "gtin",
    "mpn",
    "sku",
    "model_number",
    "category",
    "color",
    "size",
)

_NOT_ALPHANUMERIC = re.compile(r"[^0-9a-z]")
# Real duplicates almost never carry two different sizes, colours or
# barcodes when both records say: each difference counts strongly against.
VARIANT_M = 0.995
BARCODE_M = 0.97
# Two systems file the same product under different categories now and then.
CATEGORY_M = 0.9


def _variant_key(value: str | None) -> str | None:
    # "1.7 L" and "1.7l" are the same size; "Matt Black" and "matt-black" the
    # same colour.
    if value is None:
        return None
    key = _NOT_ALPHANUMERIC.sub("", value.lower())
    return key or None


def derive(frame: pd.DataFrame) -> pd.DataFrame:
    frame["size_key"] = frame["size"].map(_variant_key)
    frame["color_key"] = frame["color"].map(_variant_key)
    return frame


def _name():
    return cl.CustomComparison(
        output_column_name="product_name",
        comparison_levels=[
            cll.NullLevel("product_name"),
            cll.ExactMatchLevel("product_name", term_frequency_adjustments=True).configure(
                m_probability=0.6
            ),
            cll.ExactMatchLevel("product_name_words").configure(m_probability=0.1),
            cll.JaroWinklerLevel("product_name", VERY_CLOSE).configure(m_probability=0.15),
            cll.JaroWinklerLevel("product_name", CLOSE).configure(m_probability=0.05),
            cll.ElseLevel().configure(m_probability=0.1),
        ],
    )


def _brand():
    # Close covers a brand written two ways ("Brightwell", "Brightwell Home").
    return cl.CustomComparison(
        output_column_name="brand",
        comparison_levels=[
            cll.NullLevel("brand"),
            cll.ExactMatchLevel("brand", term_frequency_adjustments=True).configure(
                m_probability=0.85
            ),
            cll.JaroWinklerLevel("brand", CLOSE).configure(m_probability=0.1),
            cll.ElseLevel().configure(m_probability=0.05),
        ],
    )


def comparisons():
    return [
        held_exact("gtin", BARCODE_M),
        exact("mpn", 0.9),
        exact("sku", 0.5),
        _name(),
        _brand(),
        exact("manufacturer", 0.85, term_frequency=True),
        held_exact("category", CATEGORY_M),
        held_exact("size_key", VARIANT_M),
        held_exact("color_key", VARIANT_M),
    ]


def wide_net():
    return [
        block_on("gtin"),
        block_on("mpn"),
        block_on("sku", "brand"),
        block_on("model_number"),
        block_on("product_name_words"),
        block_on("brand", "product_name_prefix"),
    ]


SPEC = Spec(
    columns=COLUMNS,
    comparisons=comparisons,
    wide_net=wide_net,
    prior_blocks=lambda: [block_on("gtin"), block_on("mpn", "brand")],
    # The name pass also needs the same size and colour, so a product's own
    # variants don't teach that duplicates carry different barcodes.
    training_blocks=(
        ("gtin",),
        ("mpn", "brand"),
        ("product_name", "brand", "size_key", "color_key"),
    ),
    level_reasons={
        "gamma_gtin": {1: "gtin_same"},
        "gamma_mpn": {1: "mpn_same"},
        "gamma_sku": {1: "sku_same"},
        "gamma_product_name": {4: "name_same", 3: "name_same", 2: "name_close", 1: "name_close"},
        "gamma_brand": {2: "brand_same", 1: "brand_close"},
        "gamma_manufacturer": {1: "manufacturer_same"},
        "gamma_size_key": {1: "size_same"},
        "gamma_color_key": {1: "color_same"},
    },
    derive=derive,
)
