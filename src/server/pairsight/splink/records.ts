import type { EntityType, KeyField } from '@/lib/pairsight/entity-types'
import { matchKey } from '../match-keys'
import type { KeyContext } from '../profile/clean'
import type { ScoringRecord } from '../scoring-records'

// The records as the Splink service reads them (services/splink: each type's
// COLUMNS in person.py, company.py, product.py): each column a cleaned key
// (match-keys.ts): the cleaning Jev's comparison view uses, plus what the
// file's profile settled (profile/). Pure, so the benchmark
// (scripts/splink-spike/export.mts) writes the same file.

const KEYS = {
	person: {
		first_name: 'first_name',
		last_name: 'last_name',
		full_name: 'name',
		first_dm: 'first_name~sound',
		surname_dm: 'last_name~sound',
		name_dm: 'name~sound',
		email: 'email',
		email_local: 'email~local',
		phone: 'phone',
		dob: 'date_of_birth',
		dob_year: 'date_of_birth~year',
		postcode: 'postcode',
		postcode_district: 'postcode~district',
		city: 'city'
	},
	// The composite name is the company name, or the trading name when
	// that's all a file has.
	company: {
		company_name: 'name',
		company_name_dm: 'name~sound',
		company_name_words: 'name~words',
		trading_name: 'trading_name',
		registration_number: 'registration_number',
		tax_id: 'tax_id',
		website: 'website',
		email: 'email',
		phone: 'phone',
		postcode: 'postcode',
		postcode_district: 'postcode~district',
		city: 'city'
	},
	product: {
		product_name: 'product_name',
		product_name_prefix: 'product_name~prefix',
		product_name_words: 'product_name~words',
		brand: 'brand',
		manufacturer: 'manufacturer',
		gtin: 'gtin',
		mpn: 'mpn',
		sku: 'sku',
		model_number: 'model_number',
		category: 'category',
		color: 'color',
		size: 'size'
	}
} as const satisfies Record<EntityType, Record<string, KeyField>>

export function splinkColumns(type: EntityType): string[] {
	return ['unique_id', ...Object.keys(KEYS[type])]
}

const QUOTED = /[",\n\r]/

function cell(value: string | null): string {
	if (value == null) return ''
	return QUOTED.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

// One CSV line per record, after the header; written a line at a time so a
// big dataset never sits in memory as one string.
export function* splinkRecordLines(
	records: Iterable<ScoringRecord>,
	{ type, context }: { type: EntityType; context: KeyContext }
): Generator<string> {
	const fields: readonly KeyField[] = Object.values(KEYS[type])
	yield `${splinkColumns(type).join(',')}\n`
	for (const record of records) {
		const keys = fields.map((field) => cell(matchKey({ field, fields: record.fields, context })))
		yield `${[cell(record.id), ...keys].join(',')}\n`
	}
}
