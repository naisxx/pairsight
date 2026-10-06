import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareNatural, naturalKey } from './natural-key'

test('references sort in natural order, as plain text keys', () => {
	const references = ['R10', 'R2', 'r1', 'A100', 'A20', 'R2b', 'R02']
	assert.deepEqual([...references].sort(compareNatural), [
		'A20',
		'A100',
		'r1',
		'R02',
		'R2',
		'R2b',
		'R10'
	])
	// The keys alone sort the same way, so the database can order by them.
	assert.deepEqual(
		references.map(naturalKey).sort(),
		[...references].sort(compareNatural).map(naturalKey)
	)
})
