import { z } from 'zod'
import {
	IDENTITY_ROLES,
	rolesFor,
	type EntityType,
	type IdentityRole
} from '@/lib/pairsight/entity-types'
import type { MappedFields } from '../normalize'
import { cleanField, isPlaceholder, type KeyContext } from './clean'
import { GUESS_SIGNALS } from './country-guess'
import { dateOrderEvidence, isNumericDate, parseDate, type DateOrder } from './dates'

// What a records file looks like, field by field, read once when it's saved
// (docs/PairSight-Scale-Roadmap.md, item 12): how full each field is, its
// commonest values, the values that stand for "not known", and which way
// round its dates are written. Pair suggestions read it to clean their keys
// (clean.ts); Records shows what it found. Profiling only ever changes the
// keys pairs are picked by, never what Jev or the screens see.

// The commonest values kept per field.
const TOP_COUNT = 5
// A value this many records share, in a field where each record's should be
// its own, is a shared stand-in (a switchboard, info@…), not an identity: at
// least OVERUSED_MIN records and OVERUSED_SHARE of the file. A real record is
// rarely in a file ten times; a head-office number can be in hundreds.
export const OVERUSED_MIN = 10
export const OVERUSED_SHARE = 0.005
// Fields where each record's value should be its own.
const NEAR_UNIQUE = new Set<IdentityRole>([
	'email',
	'phone',
	'date_of_birth',
	'registration_number',
	'tax_id',
	'website',
	'gtin',
	'mpn',
	'sku'
])
// A file whose dates don't say which way round they are: US files write the
// month first, everyone else the day.
const MONTH_FIRST_COUNTRIES = new Set(['US'])

const valueSchema = z.object({
	// As cleaned for comparing ("+441134960000").
	value: z.string(),
	// As the file first wrote it ("0113 496 0000"), for the screen.
	shown: z.string(),
	count: z.number().int().nonnegative()
})

const fieldProfileSchema = z.object({
	filled: z.number().int().nonnegative(),
	distinct: z.number().int().nonnegative(),
	// Filled, not a stand-in, and still not readable as its kind (a phone,
	// an email address or a date).
	unreadable: z.number().int().nonnegative(),
	top: z.array(valueSchema),
	placeholders: z.array(valueSchema.extend({ reason: z.enum(['filler', 'overused']) }))
})

export const datasetProfileSchema = z.object({
	version: z.literal(1),
	// The evaluation's country it was profiled for: phones are read for it,
	// so a changed country means profiling again (splink/score-dataset.ts).
	country: z.string(),
	records: z.number().int().nonnegative(),
	fields: z.partialRecord(z.enum(IDENTITY_ROLES), fieldProfileSchema),
	// Numeric dates of birth: which way round, and whether the file said so
	// or the evaluation's country decided.
	dates: z.object({ order: z.enum(['dmy', 'mdy']).nullable(), assumed: z.boolean() }),
	// Where the file looked to be from (country-guess.ts), and whether the
	// evaluation's country was set from it (datasets.ts). Absent on profiles
	// from before the guess, and null when the file gave too little to go on.
	countryGuess: z
		.object({ code: z.string(), from: z.array(z.enum(GUESS_SIGNALS)), applied: z.boolean() })
		.nullable()
		.optional()
})

export type FieldProfile = z.infer<typeof fieldProfileSchema>
export type DatasetProfile = z.infer<typeof datasetProfileSchema>

export function todayIso(now: Date = new Date()): string {
	return now.toISOString().slice(0, 10)
}

function decideDateOrder(
	records: readonly MappedFields[],
	country: string
): DatasetProfile['dates'] {
	let numeric = 0
	const evidence: Record<DateOrder, number> = { dmy: 0, mdy: 0 }
	for (const { date_of_birth: value } of records) {
		if (value == null || !isNumericDate(value)) continue
		numeric += 1
		const order = dateOrderEvidence(value)
		if (order != null) evidence[order] += 1
	}
	if (numeric === 0) return { order: null, assumed: false }
	if (evidence.dmy !== evidence.mdy) {
		return { order: evidence.dmy > evidence.mdy ? 'dmy' : 'mdy', assumed: false }
	}
	return {
		order: MONTH_FIRST_COUNTRIES.has(country.toUpperCase()) ? 'mdy' : 'dmy',
		assumed: true
	}
}

function isReadable(
	role: IdentityRole,
	raw: string,
	key: string | null,
	dateOrder: DateOrder | null
) {
	switch (role) {
		case 'phone':
			return key != null
		case 'email':
			return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw.trim())
		case 'date_of_birth':
			return parseDate(raw, dateOrder) != null
		default:
			return true
	}
}

type Tally = {
	filled: number
	unreadable: number
	counts: Map<string, { shown: string; count: number; filler: boolean }>
}

// The profile of a file's mapped records, for its type. `country` is the
// evaluation's: it reads phones with no country of their own, and settles
// dates that don't say which way round they are.
export function profileRecords(
	records: readonly MappedFields[],
	{ type, country, today = todayIso() }: { type: EntityType; country: string; today?: string }
): DatasetProfile {
	const dates = decideDateOrder(records, country)
	const context: KeyContext = { country, dateOrder: dates.order, placeholders: new Map(), today }
	const tallies = new Map<IdentityRole, Tally>()
	for (const fields of records) {
		for (const role of rolesFor(type)) {
			const raw = fields[role]
			if (raw == null || raw.trim() === '') continue
			const tally = tallies.get(role) ?? { filled: 0, unreadable: 0, counts: new Map() }
			tallies.set(role, tally)
			tally.filled += 1
			const key = cleanField({ field: role, fields, context })
			const filler = isPlaceholder({ role, raw, key, context })
			if (!filler && !isReadable(role, raw, key, dates.order)) tally.unreadable += 1
			// Counted by the cleaned value, so "0113 496 0000" and "01134960000" are one.
			const value = key ?? raw.trim().toLowerCase()
			const entry = tally.counts.get(value) ?? { shown: raw.trim(), count: 0, filler }
			entry.count += 1
			tally.counts.set(value, entry)
		}
	}

	const overusedAt = Math.max(OVERUSED_MIN, Math.ceil(records.length * OVERUSED_SHARE))
	const fields: DatasetProfile['fields'] = {}
	for (const [role, tally] of tallies) {
		const ranked = [...tally.counts]
			.map(([value, entry]) => ({ value, ...entry }))
			.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
		const placeholders: FieldProfile['placeholders'] = []
		for (const { value, shown, count, filler } of ranked) {
			if (filler) placeholders.push({ value, shown, count, reason: 'filler' })
			else if (NEAR_UNIQUE.has(role) && count >= overusedAt) {
				placeholders.push({ value, shown, count, reason: 'overused' })
			}
		}
		fields[role] = {
			filled: tally.filled,
			distinct: ranked.length,
			unreadable: tally.unreadable,
			top: ranked.slice(0, TOP_COUNT).map(({ value, shown, count }) => ({ value, shown, count })),
			placeholders
		}
	}
	return { version: 1, country, records: records.length, fields, dates }
}

// A stored profile, or null when there's none or it's from an older shape.
export function parseProfile(value: unknown): DatasetProfile | null {
	const parsed = datasetProfileSchema.safeParse(value)
	return parsed.success ? parsed.data : null
}

// What key cleaning needs from a profile (clean.ts).
export function keyContextFor(
	profile: DatasetProfile,
	{ today = todayIso() }: { today?: string } = {}
): KeyContext {
	const { country } = profile
	const placeholders = new Map<IdentityRole, ReadonlySet<string>>()
	for (const role of IDENTITY_ROLES) {
		const listed = profile.fields[role]?.placeholders
		if (listed != null && listed.length > 0) {
			placeholders.set(role, new Set(listed.map(({ value }) => value)))
		}
	}
	return { country, dateOrder: profile.dates.order, placeholders, today }
}
