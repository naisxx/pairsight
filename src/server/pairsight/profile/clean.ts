import {
	isSupportedCountry,
	parsePhoneNumberFromString,
	type CountryCode
} from 'libphonenumber-js/min'
import type { BaseField, IdentityRole } from '@/lib/pairsight/entity-types'
import { normalizeField, normalizeText, type MappedFields } from '../normalize'
import { regionFor } from './country'
import { parseDate, type DateOrder } from './dates'
import { isJunk } from './placeholders'

// A field's value as PairSight's pair suggestions compare it: normalizeField
// (the value Jev's comparison view reads), plus what profiling the whole file
// settled (profile.ts): the column's date order, each record's own country
// for its phone, and the values that stand for "not known". Only the pair
// suggestions read these keys; Jev and the screens keep the uploaded values.

export type KeyContext = {
	// The evaluation's country: phones of records with no country of their own.
	country: string
	dateOrder: DateOrder | null
	// Cleaned values to treat as blank, per field: fillers and values far too
	// many records share (a switchboard, info@…).
	placeholders: ReadonlyMap<IdentityRole, ReadonlySet<string>>
	// Today as YYYY-MM-DD: a date of birth after it is a filler.
	today: string
}

export function isIdentityRole(field: BaseField): field is IdentityRole {
	return field !== 'name'
}

// See normalize.ts's own phone memo: the same reasoning, keyed by region.
const PHONE_MEMO_SIZE = 50_000
const phoneMemo = new Map<string, string | null>()

function parsePhone(phone: string, region: CountryCode): string | null {
	const parsed = parsePhoneNumberFromString(phone, region)
	return parsed != null && parsed.isPossible() ? parsed.number : null
}

// The record's phone in E.164, read for its own country. A number a
// spreadsheet stored as a number has lost its leading 0 ("7700900123"); when
// it only parses with the 0 back, it gets it back.
export function phoneKey(value: string | undefined, region: string): string | null {
	const phone = value?.trim()
	const country = region.toUpperCase()
	if (phone == null || phone === '' || !isSupportedCountry(country)) return null
	const memoKey = `${country}|${phone}`
	const known = phoneMemo.get(memoKey)
	if (known !== undefined) return known
	const key =
		parsePhone(phone, country) ?? (/^[1-9]/.test(phone) ? parsePhone(`0${phone}`, country) : null)
	if (phoneMemo.size >= PHONE_MEMO_SIZE) phoneMemo.clear()
	phoneMemo.set(memoKey, key)
	return key
}

// The cleaned value of one field, before any placeholder check.
export function cleanField({
	field,
	fields,
	context
}: {
	field: BaseField
	fields: MappedFields
	context: KeyContext
}): string | null {
	switch (field) {
		case 'phone':
			return phoneKey(fields.phone, regionFor(fields.country, context.country))
		case 'date_of_birth': {
			const value = fields.date_of_birth
			if (value == null) return null
			// A date nobody could read stays as text: still a key, as before.
			return parseDate(value, context.dateOrder) ?? normalizeText(value)
		}
		default:
			return normalizeField({ field, fields, country: context.country })
	}
}

// Whether a field's value is "not known": a filler as uploaded or once
// cleaned, or one the profile found far too many records sharing.
export function isPlaceholder({
	role,
	raw,
	key,
	context
}: {
	role: IdentityRole
	raw: string | undefined
	key: string | null
	context: KeyContext
}): boolean {
	if (raw != null && isJunk(role, raw, context.today)) return true
	if (key == null) return false
	return isJunk(role, key, context.today) || (context.placeholders.get(role)?.has(key) ?? false)
}
