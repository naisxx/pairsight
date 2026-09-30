import { isSupportedCountry, parsePhoneNumberFromString } from 'libphonenumber-js/min'
import type { IdentityRole } from './fields'

// Blocking-only normalization (docs/PairSight-V1-Scope.md, "Blocking").
// Original values are always kept for inspection and for Jev; these keys only
// decide which records share a bucket. `null` means "no usable value", and a
// null key never joins a bucket.

// A composite "name" the blocking rules can use without caring whether the
// source mapped one full-name column or separate first and last names.
export type BlockingField = IdentityRole | 'name'

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

function normalizeName(fields: MappedFields): string | null {
	const full = normalizeText(fields.full_name)
	if (full != null) return full
	const first = normalizeText(fields.first_name)
	const last = normalizeText(fields.last_name)
	return first != null && last != null ? `${first} ${last}` : null
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
		default:
			return normalizeText(fields[field])
	}
}
