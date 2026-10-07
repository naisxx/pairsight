import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ENTITY_TYPES, type EntityType } from '@/lib/pairsight/entity-types'
import type { BlockingRecord } from '../blocking'
import { splinkColumns, splinkRecordLines } from './records'

// One record's line as column -> value.
function written(type: EntityType, record: BlockingRecord): (column: string) => string | undefined {
	const [, line] = [...splinkRecordLines([record], { type, country: 'GB' })]
	const cells = (line ?? '').trimEnd().split(',')
	return (column) => cells[splinkColumns(type).indexOf(column)]
}

test('records go to Splink cleaned by our own blocking keys, one line each', () => {
	const lines = [
		...splinkRecordLines(
			[
				{
					id: 'r1',
					fields: {
						first_name: ' Jane ',
						last_name: 'Smith',
						email: 'Jane.Smith+news@Example.com',
						phone: '07700 900123',
						date_of_birth: '1990-04-12',
						postcode: 'so4 5hq',
						city: 'Southampton'
					}
				},
				{ id: 'r2', fields: { first_name: 'Ann, "Annie"' } }
			],
			{ type: 'person', country: 'GB' }
		)
	]
	assert.equal(lines[0], `${splinkColumns('person').join(',')}\n`)
	const cells = (lines[1] ?? '').trimEnd().split(',')
	const value = (column: string) => cells[splinkColumns('person').indexOf(column)]
	assert.equal(value('unique_id'), 'r1')
	assert.equal(value('first_name'), 'jane')
	assert.equal(value('full_name'), 'jane smith')
	assert.equal(value('email'), 'jane.smith+news@example.com')
	assert.equal(value('email_local'), 'jane.smith')
	assert.equal(value('phone'), '+447700900123')
	assert.equal(value('dob_year'), '1990')
	assert.equal(value('postcode'), 'SO45HQ')
	assert.equal(value('postcode_district'), 'SO4')
	// Missing values are empty; commas and quotes are quoted.
	assert.equal(lines[2], 'r2,"ann, ""annie""",,,AN AN,,,,,,,,,,\n')
})

test('organisations go with their names cleaned of legal suffixes, and their ids', () => {
	const value = written('company', {
		id: 'c1',
		fields: {
			company_name: 'Northwind & Sons Ltd',
			trading_name: 'Northwind',
			registration_number: '0123 4567',
			website: 'https://www.Northwind.example/contact',
			postcode: 'LS6 2AB'
		}
	})
	assert.equal(value('company_name'), 'northwind and sons')
	assert.equal(value('company_name_words'), 'and northwind sons')
	assert.equal(value('trading_name'), 'northwind')
	assert.equal(value('registration_number'), '01234567')
	assert.equal(value('website'), 'northwind.example')
	assert.equal(value('postcode_district'), 'LS6')
	// Only a trading name: it stands in as the name.
	assert.equal(
		written('company', { id: 'c2', fields: { trading_name: 'Acme' } })('company_name'),
		'acme'
	)
})

test('products go with their codes cleaned, and their sizes and colours as written', () => {
	const value = written('product', {
		id: 'g1',
		fields: {
			product_name: 'Nova Kettle',
			brand: 'Brightwell',
			gtin: '5012345678900',
			mpn: 'bw-1042',
			size: '1.7 L',
			color: 'Matt Black'
		}
	})
	assert.equal(value('product_name'), 'nova kettle')
	assert.equal(value('product_name_prefix'), 'nova')
	assert.equal(value('gtin'), '05012345678900')
	assert.equal(value('mpn'), 'BW1042')
	assert.equal(value('brand'), 'brightwell')
	assert.equal(value('size'), '1.7 l')
})

// The service checks every column is there (model.prepare); this checks
// both sides list the same ones, so a column added on one side can't drift.
test('each type writes exactly the columns its model reads', () => {
	for (const type of ENTITY_TYPES) {
		const source = readFileSync(
			new URL(`../../../../services/splink/pairsight_splink/${type}.py`, import.meta.url),
			'utf8'
		)
		const block = /^COLUMNS = \(([^)]*)\)/m.exec(source)?.[1] ?? ''
		const columns = [...block.matchAll(/"([a-z_]+)"/g)].map((match) => match[1])
		assert.deepEqual(columns, splinkColumns(type), type)
	}
})
