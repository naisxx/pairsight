// Input length limits shared by PairSight's server actions and client forms
// (so the form's maxLength and the server's validation can't drift apart).
// Kept outside src/server so client components can import it.
export const NAME_MAX_LENGTH = 120
export const FILE_NAME_MAX_LENGTH = 255
export const SEARCH_MAX_LENGTH = 100
