"""The model for organisations: names, company numbers, websites and addresses.

Company names arrive with their legal suffixes stripped and "&" spelled out
(normalizeCompanyName), so "Acme & Sons Ltd" and "ACME AND SONS LIMITED" are
already the same name here.

The identifiers hold their weights (spec.held_exact): files rarely hold two
records of one firm that both carry its number, so training can't see that a
different company number means a different firm, and learned nothing from
it. Two firms with one name in one city then looked like duplicates.
"""

from __future__ import annotations

import splink.comparison_level_library as cll
import splink.comparison_library as cl
from splink import block_on

from .spec import CLOSE, VERY_CLOSE, Spec, held_exact, with_spaced_postcode

COLUMNS = (
    "unique_id",
    "company_name",
    "company_name_dm",
    "company_name_words",
    "trading_name",
    "registration_number",
    "tax_id",
    "website",
    "email",
    "phone",
    "postcode",
    "postcode_district",
    "city",
)

# How often a real duplicate carries the same value, when both records have one.
ID_M = 0.98
WEBSITE_M = 0.8
PHONE_M = 0.7

# One record's trading name is the other's company name: a business filed
# under the name it trades as.
TRADING_NAME_SWAPPED = (
    '("company_name_l" = "trading_name_r") OR ("trading_name_l" = "company_name_r")'
)


def _name():
    # Starting guesses per level, best first (see spec.exact): training
    # replaces each level it sees.
    return cl.CustomComparison(
        output_column_name="company_name",
        comparison_levels=[
            cll.NullLevel("company_name"),
            cll.ExactMatchLevel("company_name", term_frequency_adjustments=True).configure(
                m_probability=0.6
            ),
            # The same words in another order ("Foods Northwind").
            cll.ExactMatchLevel("company_name_words").configure(m_probability=0.05),
            cll.CustomLevel(TRADING_NAME_SWAPPED, "Trading name matches").configure(
                m_probability=0.1
            ),
            cll.JaroWinklerLevel("company_name", VERY_CLOSE).configure(m_probability=0.1),
            cll.JaroWinklerLevel("company_name", CLOSE).configure(m_probability=0.05),
            cll.ElseLevel().configure(m_probability=0.1),
        ],
    )


def comparisons():
    return [
        _name(),
        # One firm, one number: a different one all but rules it out.
        held_exact("registration_number", ID_M),
        held_exact("tax_id", ID_M),
        # Firms change website and phone more often than number.
        held_exact("website", WEBSITE_M),
        cl.EmailComparison("email"),
        held_exact("phone", PHONE_M),
        cl.PostcodeComparison("postcode_spaced"),
        cl.ExactMatch("city").configure(term_frequency_adjustments=True),
    ]


def wide_net():
    return [
        block_on("registration_number"),
        block_on("tax_id"),
        block_on("website"),
        block_on("email"),
        block_on("phone"),
        block_on("company_name"),
        block_on("company_name_dm", "postcode_district"),
        # A misspelt name after a move across town. (Name prefix and city
        # was 3.5M pairs at 100K records, for almost nothing more.)
        block_on("company_name_dm", "city"),
        block_on("postcode"),
    ]


SPEC = Spec(
    columns=COLUMNS,
    comparisons=comparisons,
    wide_net=wide_net,
    prior_blocks=lambda: [block_on("registration_number"), block_on("website")],
    training_blocks=(("registration_number",), ("website",), ("company_name", "postcode")),
    level_reasons={
        "gamma_company_name": {
            5: "name_same",
            4: "name_same",
            3: "trading_name_same",
            2: "name_close",
            1: "name_close",
        },
        "gamma_registration_number": {1: "registration_same"},
        "gamma_tax_id": {1: "tax_id_same"},
        "gamma_website": {1: "website_same"},
        "gamma_email": {4: "email_same", 3: "email_username", 2: "email_close", 1: "email_close"},
        "gamma_phone": {1: "phone_same"},
        "gamma_postcode_spaced": {4: "postcode_same", 3: "postcode_area", 2: "postcode_area"},
        "gamma_city": {1: "city_same"},
    },
    derive=with_spaced_postcode,
)
