import { getCountries, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min'
import type { MappedFields } from '../normalize'
import { regionFor } from './country'

// Where a file's records are from, read from what only one country writes:
// a country column, international phone numbers, postcode shapes no other
// country shares, and country web domains. Plain five-digit postcodes and
// local phone numbers fit too many countries to count. The evaluation's
// country starts from this (datasets.ts), and the user can change it.

export const GUESS_SIGNALS = ['country', 'phone', 'postcode', 'domain'] as const
export type GuessSignal = (typeof GUESS_SIGNALS)[number]
export type CountryGuess = { code: CountryCode; from: GuessSignal[] }

// A guess needs this many signals, and this share of them for one country.
const MIN_VOTES = 10
const MIN_SHARE = 0.6

// Postcodes whose shape belongs to one country.
const POSTCODES: Array<[CountryCode, RegExp]> = [
	['GB', /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i],
	['CA', /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i],
	['IE', /^[A-Z]\d{2} ?[A-Z\d]{4}$/i],
	['NL', /^\d{4} ?[A-Z]{2}$/i],
	['US', /^\d{5}-\d{4}$/]
]
// Country domains used for something else entirely.
const VANITY_DOMAINS = new Set(['io', 'co', 'ai', 'me', 'tv', 'fm', 'ly', 'gg', 'to', 'cc', 'ws'])
const DOMAIN_ALIASES: Record<string, string> = { uk: 'GB' }

let known: Set<string> | null = null
function isCountry(code: string): code is CountryCode {
	known ??= new Set(getCountries())
	return known.has(code)
}

function fromPhone(value: string): CountryCode | null {
	const trimmed = value.trim()
	if (!trimmed.startsWith('+') && !trimmed.startsWith('00')) return null
	const parsed = parsePhoneNumberFromString(trimmed.replace(/^00/, '+'))
	return parsed?.country ?? null
}

function fromPostcode(value: string): CountryCode | null {
	const trimmed = value.trim()
	return POSTCODES.find(([, shape]) => shape.test(trimmed))?.[0] ?? null
}

function fromDomain(value: string): CountryCode | null {
	const host = value
		.trim()
		.toLowerCase()
		.replace(/^.*@/, '')
		.replace(/^[a-z]+:\/\//, '')
		.split(/[/?#:]/)[0]
	const tld = host?.split('.').at(-1)
	if (tld == null || tld.length !== 2 || VANITY_DOMAINS.has(tld)) return null
	const code = DOMAIN_ALIASES[tld] ?? tld.toUpperCase()
	return isCountry(code) ? code : null
}

function fromCountryCell(value: string): CountryCode | null {
	const code = regionFor(value, '')
	return code !== '' && isCountry(code) ? code : null
}

export function guessCountry(records: MappedFields[]): CountryGuess | null {
	const votes = new Map<CountryCode, Map<GuessSignal, number>>()
	let total = 0
	const vote = (code: CountryCode | null, signal: GuessSignal) => {
		if (code == null) return
		const bySignal = votes.get(code) ?? new Map<GuessSignal, number>()
		bySignal.set(signal, (bySignal.get(signal) ?? 0) + 1)
		votes.set(code, bySignal)
		total++
	}
	for (const record of records) {
		if (record.country != null) vote(fromCountryCell(record.country), 'country')
		if (record.phone != null) vote(fromPhone(record.phone), 'phone')
		if (record.postcode != null) vote(fromPostcode(record.postcode), 'postcode')
		for (const value of [record.email, record.website]) {
			if (value != null) vote(fromDomain(value), 'domain')
		}
	}
	if (total < MIN_VOTES) return null
	const count = (bySignal: Map<GuessSignal, number>) =>
		[...bySignal.values()].reduce((sum, each) => sum + each, 0)
	const [winner] = [...votes.entries()].sort(([, a], [, b]) => count(b) - count(a))
	if (winner == null || count(winner[1]) / total < MIN_SHARE) return null
	const [code, bySignal] = winner
	return { code, from: GUESS_SIGNALS.filter((signal) => bySignal.has(signal)) }
}
