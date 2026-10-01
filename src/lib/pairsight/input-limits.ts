// Input length limits shared by PairSight's server actions and client forms
// (so the form's maxLength and the server's validation can't drift apart).
// Kept outside src/server so client components can import it.
export const NAME_MAX_LENGTH = 120
export const FILE_NAME_MAX_LENGTH = 255
export const SEARCH_MAX_LENGTH = 100
// A two-letter country code, as typed (the server uppercases it).
export const COUNTRY_CODE_PATTERN = /^[A-Za-z]{2}$/

// Rows per page in the results table; the first is the default.
export const PAGE_SIZES = [50, 25, 15] as const
