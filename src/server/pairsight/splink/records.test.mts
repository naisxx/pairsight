import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SPLINK_COLUMNS, splinkRecordLines } from './records'

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
			'GB'
		)
	]
	assert.equal(lines[0], `${SPLINK_COLUMNS.join(',')}\n`)
	const cells = (lines[1] ?? '').trimEnd().split(',')
	const value = (column: string) => cells[SPLINK_COLUMNS.indexOf(column as never)]
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
