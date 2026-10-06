import type { BlockingField } from '@/lib/pairsight/entity-types'
import type { BlockingRecord } from '../blocking'
import { ruleFieldKey } from '../key-transforms'

// The records as the Splink service reads them (services/splink,
// RECORD_COLUMNS in model.py): each column the key our own blocking code
// computes, so Splink and the comparison rules start from the same cleaning.
// Pure, so the benchmark (scripts/splink-spike/export.mts) writes the same file.

const KEYS: Record<string, BlockingField> = {
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
}

export const SPLINK_COLUMNS = ['unique_id', ...Object.keys(KEYS)] as const

const QUOTED = /[",\n\r]/

function cell(value: string | null): string {
	if (value == null) return ''
	return QUOTED.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

// One CSV line per record, after the header; written a line at a time so a
// big dataset never sits in memory as one string.
export function* splinkRecordLines(
	records: Iterable<BlockingRecord>,
	country: string
): Generator<string> {
	yield `${SPLINK_COLUMNS.join(',')}\n`
	for (const record of records) {
		const keys = Object.values(KEYS).map((field) =>
			cell(ruleFieldKey({ field, fields: record.fields, country }))
		)
		yield `${[cell(record.id), ...keys].join(',')}\n`
	}
}
