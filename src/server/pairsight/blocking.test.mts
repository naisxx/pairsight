import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildBlockedPairs, RULE_PRESETS } from './blocking'
import { LIMITS } from './limits'
import { groupPairCount } from './pairs'

const people = [
	{
		id: 'r1',
		fields: {
			email: 'jane@x.com',
			phone: '415 555 0101',
			first_name: 'Jane',
			last_name: 'Smith',
			postcode: '10001'
		}
	},
	{
		id: 'r2',
		fields: { email: 'JANE@x.com', first_name: 'Jane', last_name: 'Smyth', postcode: '10001' }
	},
	{
		id: 'r3',
		fields: {
			email: 'john@x.com',
			phone: '(415) 555-0101',
			first_name: 'John',
			last_name: 'Smith',
			postcode: '10001'
		}
	},
	{ id: 'r4', fields: { first_name: 'Ann', last_name: 'Lee', postcode: '94103' } },
	{ id: 'r5', fields: { first_name: 'Bo', last_name: 'Kim', postcode: '30301' } }
]

test('blocking builds overlapping buckets and dedupes pairs across rules', () => {
	const rules = [
		{ id: 'email', fields: ['email' as const] },
		{ id: 'phone', fields: ['phone' as const] },
		{ id: 'last_postcode', fields: ['last_name' as const, 'postcode' as const] }
	]
	const { pairs, stats } = buildBlockedPairs({ records: people, rules, country: 'US' })
	assert.deepEqual(
		pairs.map((p) => [p.a, p.b, p.ruleIds]),
		[
			['r1', 'r2', ['email']],
			['r1', 'r3', ['phone', 'last_postcode']]
		]
	)
	assert.equal(stats.find((s) => s.ruleId === 'phone')?.recordsWithoutKey, 3)
})

test('records missing a value never share a blank bucket', () => {
	const blanks = Array.from({ length: 10 }, (_, i) => ({ id: `b${i}`, fields: { email: '' } }))
	const { pairs, stats } = buildBlockedPairs({
		records: blanks,
		rules: [RULE_PRESETS[0]],
		country: 'US'
	})
	assert.equal(pairs.length, 0)
	assert.equal(stats[0].recordsWithoutKey, 10)
})

test('buckets above the warning size are reported with their pair expansion', () => {
	const size = LIMITS.bucketWarningSize + 1
	const same = Array.from({ length: size }, (_, i) => ({
		id: `s${i}`,
		fields: { email: 'a@x.com' }
	}))
	const { stats } = buildBlockedPairs({ records: same, rules: [RULE_PRESETS[0]], country: 'US' })
	assert.deepEqual(stats[0].oversizedBuckets, [{ size, pairCount: groupPairCount(size) }])
	assert.equal(stats[0].largestBucket, size)
})
