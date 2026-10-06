import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildBlockedPairs, presetsFor } from './blocking'

const EMAIL_RULE = { id: 'email', fields: ['email' as const] }
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
		rules: [EMAIL_RULE],
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
	const { stats } = buildBlockedPairs({ records: same, rules: [EMAIL_RULE], country: 'US' })
	assert.deepEqual(stats[0].oversized, {
		groups: 1,
		pairCount: groupPairCount(size),
		largest: size
	})
	assert.equal(stats[0].largestBucket, size)
})

test('each rule shows a sample key, from a shared bucket when there is one', () => {
	const { stats } = buildBlockedPairs({
		records: people,
		rules: [
			{ id: 'last_postcode', fields: ['last_name', 'postcode'] },
			{ id: 'first', fields: ['first_name'] }
		],
		country: 'US'
	})
	// r1 and r3 share "smith" + "10001"; r1's own key isn't shared by first name.
	assert.deepEqual(stats[0]?.sampleKey, ['smith', '10001'])
	assert.equal(stats[1]?.sampleKey?.length, 1)
})

const preset = (type: Parameters<typeof presetsFor>[0], id: string) => {
	const rule = presetsFor(type).find((candidate) => candidate.id === id)
	assert.ok(rule)
	return { id: rule.id, fields: [...rule.fields] }
}

test('organisations block on website domain and on names without their legal form', () => {
	const records = [
		{ id: 'a', fields: { company_name: 'Acme Ltd', website: 'https://www.acme.test/about' } },
		{ id: 'b', fields: { company_name: 'ACME Limited', website: 'acme.test' } },
		{ id: 'c', fields: { company_name: 'Acme & Sons', website: 'acmesons.test' } }
	]
	const byWebsite = buildBlockedPairs({
		records,
		rules: [preset('company', 'website')],
		country: 'GB'
	})
	assert.deepEqual(
		byWebsite.pairs.map((pair) => [pair.a, pair.b]),
		[['a', 'b']]
	)
	const byName = buildBlockedPairs({ records, rules: [preset('company', 'name')], country: 'GB' })
	assert.deepEqual(
		byName.pairs.map((pair) => [pair.a, pair.b]),
		[['a', 'b']]
	)
})

test('products block on one barcode however it is written, and on part number with brand', () => {
	const records = [
		{ id: 'a', fields: { gtin: '012345678905', mpn: 'AB-123', brand: 'Northpeak' } },
		{ id: 'b', fields: { gtin: '0012345678905', mpn: 'ab123', brand: 'northpeak' } },
		{ id: 'c', fields: { gtin: '4006381333931', mpn: 'AB-123', brand: 'Other' } }
	]
	const byGtin = buildBlockedPairs({ records, rules: [preset('product', 'gtin')], country: 'US' })
	assert.deepEqual(
		byGtin.pairs.map((pair) => [pair.a, pair.b]),
		[['a', 'b']]
	)
	const byPart = buildBlockedPairs({
		records,
		rules: [preset('product', 'mpn_brand')],
		country: 'US'
	})
	assert.deepEqual(
		byPart.pairs.map((pair) => [pair.a, pair.b]),
		[['a', 'b']]
	)
})
