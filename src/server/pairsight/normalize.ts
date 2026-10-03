import { isSupportedCountry, parsePhoneNumberFromString } from 'libphonenumber-js/min'
import type { BlockingField, IdentityRole } from '@/lib/pairsight/entity-types'
import { isValidGtin } from '@/lib/pairsight/gtin'

// Blocking-only normalization (docs/PairSight-V1-Scope.md, "Blocking").
// Original values are always kept for inspection and for Jev; these keys only
// decide which records share a bucket. `null` means "no usable value", and a
// null key never joins a bucket.

// A composite "name" the blocking rules can use without caring which name
// fields the source mapped (NAME_SOURCES).
export type { BlockingField }

export type MappedFields = Partial<Record<IdentityRole, string>>

function collapse(value: string): string {
	return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
}

function present(value: string | undefined): string | null {
	if (value == null) return null
	const trimmed = value.trim()
	return trimmed === '' ? null : trimmed
}

export function normalizeEmail(value: string | undefined): string | null {
	const email = present(value)
	return email == null ? null : email.toLowerCase()
}

export function normalizePhone(value: string | undefined, country: string): string | null {
	const phone = present(value)
	const region = country.toUpperCase()
	if (phone == null || !isSupportedCountry(region)) return null
	const parsed = parsePhoneNumberFromString(phone, region)
	return parsed != null && parsed.isPossible() ? parsed.number : null
}

export function normalizeText(value: string | undefined): string | null {
	const text = present(value)
	return text == null ? null : collapse(text)
}

export function normalizePostcode(value: string | undefined): string | null {
	const postcode = present(value)
	return postcode == null ? null : postcode.toUpperCase().replace(/\s+/g, '')
}

// Legal-form words a company name may carry or drop ("Acme Ltd" / "ACME
// Limited" / "Acme"), removed from the end of the name for blocking.
const LEGAL_SUFFIXES = new Set([
	'ag',
	'bv',
	'co',
	'company',
	'corp',
	'corporation',
	'gmbh',
	'inc',
	'incorporated',
	'kg',
	'limited',
	'llc',
	'llp',
	'lp',
	'ltd',
	'nv',
	'oy',
	'plc',
	'pty',
	'sa',
	'sarl',
	'sas',
	'spa',
	'srl'
])

export function normalizeCompanyName(value: string | undefined): string | null {
	const name = normalizeText(value)
	if (name == null) return null
	const words = name
		.replace(/&/g, ' and ')
		.replace(/[^\p{L}\p{N}\s]/gu, '')
		.split(/\s+/)
		.filter((word) => word !== '')
	while (words.length > 1 && LEGAL_SUFFIXES.has(words.at(-1) ?? '')) words.pop()
	return words.length === 0 ? null : words.join(' ')
}

// A website as its host: no scheme, `www.`, port, path or query.
export function normalizeWebsite(value: string | undefined): string | null {
	const site = normalizeText(value)
	if (site == null) return null
	const host = site
		.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
		.replace(/^www\d?\./, '')
		.split(/[/?#:]/)[0]
		?.replace(/\.$/, '')
	return host == null || host === '' ? null : host
}

const GTIN_LENGTH = 14

// A barcode (EAN-8, UPC-A, EAN-13, GTIN-14) as 14 digits, so the same item
// keyed as UPC and as EAN lands in one bucket. A number that fails its check
// digit is kept as written: it may still be how both files spell it.
export function normalizeGtin(value: string | undefined): string | null {
	const gtin = present(value)
	if (gtin == null) return null
	const digits = gtin.replace(/[\s-]/g, '')
	return isValidGtin(digits) ? digits.padStart(GTIN_LENGTH, '0') : digits.toUpperCase()
}

// Codes (part numbers, SKUs, registration and tax IDs) as letters and digits
// only, so "AB-123 45" and "ab12345" match.
export function normalizeCode(value: string | undefined): string | null {
	const code = present(value)
	if (code == null) return null
	const cleaned = code
		.normalize('NFKC')
		.toUpperCase()
		.replace(/[^\p{L}\p{N}]/gu, '')
	return cleaned === '' ? null : cleaned
}

// The record's name, from whichever name fields its type maps
// (NAME_SOURCES): a person's full or first + last name, an organisation's
// name, a product's name.
function normalizeName(fields: MappedFields): string | null {
	const full = normalizeText(fields.full_name)
	if (full != null) return full
	const first = normalizeText(fields.first_name)
	const last = normalizeText(fields.last_name)
	if (first != null && last != null) return `${first} ${last}`
	return (
		normalizeCompanyName(fields.company_name) ??
		normalizeCompanyName(fields.trading_name) ??
		normalizeText(fields.product_name)
	)
}

export function normalizeField({
	field,
	fields,
	country
}: {
	field: BlockingField
	fields: MappedFields
	country: string
}): string | null {
	switch (field) {
		case 'name':
			return normalizeName(fields)
		case 'email':
			return normalizeEmail(fields.email)
		case 'phone':
			return normalizePhone(fields.phone, country)
		case 'postcode':
			return normalizePostcode(fields.postcode)
		case 'company_name':
		case 'trading_name':
			return normalizeCompanyName(fields[field])
		case 'website':
			return normalizeWebsite(fields.website)
		case 'gtin':
			return normalizeGtin(fields.gtin)
		case 'mpn':
		case 'sku':
		case 'model_number':
		case 'registration_number':
		case 'tax_id':
			return normalizeCode(fields[field])
		default:
			return normalizeText(fields[field])
	}
}
