"""The model for people: names, birth dates, emails, phones and postcodes."""

from __future__ import annotations

import splink.comparison_library as cl
from splink import block_on

from .spec import Spec, with_spaced_postcode

COLUMNS = (
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


def comparisons():
    return [
        # Names: graded similarity, a level for first and last swapped, and
        # term frequency so sharing "Smith" counts for less.
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
    ]


def wide_net():
    # Surname sound alone was 73M pairs at 100K records (common surnames), so
    # it's narrowed by birth year.
    return [
        block_on("surname_dm", "dob_year"),
        block_on("first_dm", "postcode_district"),
        block_on("email_local"),
        block_on("phone"),
        block_on("dob"),
        block_on("postcode"),
    ]


SPEC = Spec(
    columns=COLUMNS,
    comparisons=comparisons,
    wide_net=wide_net,
    prior_blocks=lambda: [block_on("email"), block_on("phone")],
    # Same birth date or surname sound alone made EM learn "same family".
    training_blocks=(("email_local",), ("full_name",), ("surname_dm", "dob")),
    level_reasons={
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
    },
    derive=with_spaced_postcode,
)
