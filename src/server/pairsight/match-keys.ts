import { doubleMetaphone } from 'double-metaphone'
import { parseKeyField, type KeyTransform } from '@/lib/pairsight/derived-keys'
import type { KeyField } from '@/lib/pairsight/entity-types'
import { normalizeField, type MappedFields } from './normalize'

// A record's cleaned keys, as PairSight's pair suggestions read them
// (src/server/pairsight/splink/records.ts): a field's normal key, or one
// derived from it (src/lib/pairsight/derived-keys.ts). Each derived key starts
// from the field's normal key, so "Smyth " and "SMYTH" are already one value
// before the transform loosens it further. Null means no usable key.

const PREFIX_LENGTH = 4
const PHONE_TAIL_LENGTH = 7
// A UK postcode without its space: the outward code (district) is all but
// the last three characters ("SW1A1AA" → "SW1A").
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/
const UK_INWARD_LENGTH = 3
// Elsewhere, the first three characters ("94110" → "941", a US sectional
// centre; "10115" → "101").
const DISTRICT_LENGTH = 3
const YEAR = /\b(1[89]|20)\d{2}\b/

function letters(value: string): string {
	return value.normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, '')
}

function wordsOf(value: string): string[] {
	return letters(value)
		.split(/\s+/)
		.filter((word) => word !== '')
}

function orNull(value: string | undefined): string | null {
	return value == null || value === '' ? null : value
}

// Each word as it sounds (Double Metaphone's primary code), in any order, so
// "Jon Smyth", "John Smith" and "Smith John" share a key. English-leaning:
// good on common English, Germanic, Slavic and Spanish spellings, weaker on
// transliterated names.
function soundKey(value: string): string | null {
	const codes = wordsOf(value)
		.map((word) => doubleMetaphone(word)[0])
		.filter((code) => code !== '')
	return codes.length === 0 ? null : codes.sort().join(' ')
}

function emailParts(value: string): { local: string; domain: string } | null {
	const at = value.lastIndexOf('@')
	if (at <= 0 || at === value.length - 1) return null
	return { local: value.slice(0, at), domain: value.slice(at + 1) }
}

function districtKey(postcode: string): string {
	return UK_POSTCODE.test(postcode)
		? postcode.slice(0, -UK_INWARD_LENGTH)
		: postcode.slice(0, DISTRICT_LENGTH)
}

function transformKey({
	transform,
	value,
	raw
}: {
	transform: KeyTransform
	// The field's normal key.
	value: string
	// The field as uploaded, for the transforms that don't trust the key.
	raw: string | undefined
}): string | null {
	switch (transform) {
		case 'sound':
			return soundKey(value)
		case 'prefix':
			return orNull(wordsOf(value).join('').slice(0, PREFIX_LENGTH))
		case 'words':
			return orNull([...new Set(wordsOf(value))].sort().join(' '))
		case 'initial':
			return orNull(wordsOf(value)[0]?.slice(0, 1))
		case 'local':
			return orNull(emailParts(value)?.local.split('+')[0])
		case 'domain':
			return orNull(emailParts(value)?.domain)
		case 'year':
			return orNull(YEAR.exec(value)?.[0])
		case 'district':
			return orNull(districtKey(value))
		case 'last7': {
			// From the digits as written: a number saved without its country
			// code may not parse for the evaluation's country at all.
			const digits = (raw ?? value).replace(/\D/g, '')
			return digits.length < PHONE_TAIL_LENGTH ? null : digits.slice(-PHONE_TAIL_LENGTH)
		}
	}
}

// A record's key for one field, derived or not. For a plain field this is
// exactly normalizeField, the value Jev's comparison view reads too.
export function matchKey({
	field,
	fields,
	country
}: {
	field: KeyField
	fields: MappedFields
	country: string
}): string | null {
	const { base, transform } = parseKeyField(field)
	if (transform === 'last7') {
		return transformKey({ transform, value: '', raw: fields.phone })
	}
	const value = normalizeField({ field: base, fields, country })
	if (value == null || transform == null) return value
	return transformKey({ transform, value, raw: base === 'name' ? undefined : fields[base] })
}
