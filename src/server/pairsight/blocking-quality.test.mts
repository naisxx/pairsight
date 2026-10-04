import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isFuzzyRule } from '@/lib/pairsight/derived-keys'
import { defaultRules, presetsFor } from '@/lib/pairsight/entity-types'
import { CHECK_COUNTRY, loadBlockingCheck } from '../../../scripts/blocking-check/load.mts'
import { blockingQuality } from './blocking-quality'

// The planted-duplicate check (pnpm blocking:check), held in place: exact
// rules miss most hard duplicates, the fuzzy presets find most of them, and
// they do it for a handful of extra pairs, not thousands.
const EXACT_AT_MOST = 0.4
const FUZZY_AT_LEAST = 0.85
const MAX_EXTRA_PAIRS_PER_RECORD = 0.5

test('fuzzy presets find the hard duplicates exact rules miss, cheaply', async () => {
	const { records, duplicates } = await loadBlockingCheck()
	const exact = defaultRules('person')
	const fuzzy = presetsFor('person')
		.filter(isFuzzyRule)
		.map((preset) => ({ id: preset.id, fields: [...preset.fields] }))
	const before = blockingQuality({ records, rules: exact, duplicates, country: CHECK_COUNTRY })
	const after = blockingQuality({
		records,
		rules: [...exact, ...fuzzy],
		duplicates,
		country: CHECK_COUNTRY
	})
	assert.ok(before.completeness <= EXACT_AT_MOST, `exact found ${before.found}/${before.known}`)
	assert.ok(after.completeness >= FUZZY_AT_LEAST, `fuzzy found ${after.found}/${after.known}`)
	assert.ok(after.pairCount - before.pairCount <= records.length * MAX_EXTRA_PAIRS_PER_RECORD)
	// Nicknames across districts are out of reach for every preset, on purpose.
	assert.ok(after.missed.some((miss) => miss.kind.startsWith('very hard')))
})

test('completeness counts a duplicate once, in either order', () => {
	const records = [
		{ id: 'a', fields: { email: 'x@example.com' } },
		{ id: 'b', fields: { email: 'X@example.com' } },
		{ id: 'c', fields: { email: 'y@example.com' } }
	]
	const quality = blockingQuality({
		records,
		rules: [{ id: 'email', fields: ['email'] }],
		duplicates: [
			{ recordA: 'b', recordB: 'a', kind: 'easy' },
			{ recordA: 'a', recordB: 'c', kind: 'hard' }
		],
		country: CHECK_COUNTRY
	})
	assert.equal(quality.found, 1)
	assert.equal(quality.completeness, 0.5)
	assert.equal(quality.pairCount, 1)
	assert.deepEqual(
		quality.missed.map((miss) => miss.kind),
		['hard']
	)
})
