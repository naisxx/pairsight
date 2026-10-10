import type { IdentityRole } from '@/lib/pairsight/entity-types'

// Values that stand in for "not known": "N/A", "unknown", all zeros,
// test@test.com, a date of birth of 1 January 1900. Treated as blank when
// picking pairs, because two strangers who both say "N/A" look alike to a
// matcher (Randall et al. 2013: the one cleaning step that helped every
// time). The original value is kept for Jev and on screen.

const JUNK_WORDS = new Set([
	'n/a',
	'n.a.',
	'n.a',
	'na',
	'none',
	'null',
	'nil',
	'nan',
	'unknown',
	'not known',
	'not applicable',
	'not provided',
	'not given',
	'missing',
	'blank',
	'empty',
	'tbc',
	'tba',
	'test',
	'no',
	'no email',
	'noemail',
	'no phone',
	'-',
	'--',
	'?',
	'.',
	'x',
	'0'
])
// The part before the @ of an address nobody reads: a placeholder whatever
// the domain.
const JUNK_EMAIL_LOCALS = new Set([
	'test',
	'noreply',
	'no-reply',
	'donotreply',
	'do-not-reply',
	'none',
	'na',
	'unknown',
	'noemail',
	'nobody',
	'x'
])
// One character over and over ("0000000", "xxxx", "9999"): a filler.
const REPEATED = /^(.)\1{2,}$/
// Fewer digits than any real phone number.
const MIN_PHONE_DIGITS = 5
// Dates of birth on or before this are fillers (1900-01-01, 1899-12-31).
const OLDEST_BIRTH = '1900-01-01'

function letterOrDigits(value: string): string {
	return value.replace(/[^\p{L}\p{N}]/gu, '')
}

// Identifiers and contact details: where a filler is common and a short or
// repeated value is never real. Descriptive fields ("0" is a dress size,
// "XXL" a size) are left alone.
const CODE_ROLES = new Set<IdentityRole>([
	'email',
	'phone',
	'date_of_birth',
	'postcode',
	'registration_number',
	'tax_id',
	'website',
	'gtin',
	'mpn',
	'sku',
	'model_number'
])
// Names only lose the unmistakable fillers: "Na" and "No" are surnames.
const NAME_ROLES = new Set<IdentityRole>([
	'full_name',
	'first_name',
	'last_name',
	'company_name',
	'trading_name',
	'product_name'
])
const NAME_JUNK = new Set([
	'unknown',
	'not known',
	'n/a',
	'n.a.',
	'none',
	'null',
	'test',
	'tbc',
	'-',
	'?'
])

// Whether a value (as uploaded, or its cleaned key) is a placeholder for this
// field. `today` bounds dates of birth: one in the future is a filler too.
export function isJunk(role: IdentityRole, value: string, today: string): boolean {
	const text = value.trim().toLowerCase().replace(/\s+/g, ' ')
	if (text === '') return false
	if (NAME_ROLES.has(role)) return NAME_JUNK.has(text)
	if (!CODE_ROLES.has(role)) return false
	if (JUNK_WORDS.has(text)) return true
	const compact = letterOrDigits(text)
	if (compact === '' || REPEATED.test(compact)) return true
	switch (role) {
		case 'email': {
			const at = text.lastIndexOf('@')
			return at > 0 && JUNK_EMAIL_LOCALS.has(text.slice(0, at))
		}
		case 'phone':
			return text.replace(/\D/g, '').length < MIN_PHONE_DIGITS
		case 'date_of_birth':
			// Only an ISO date can be compared as text; others are judged once read.
			return /^\d{4}-\d{2}-\d{2}$/.test(text) && (text <= OLDEST_BIRTH || text > today)
		default:
			return false
	}
}
