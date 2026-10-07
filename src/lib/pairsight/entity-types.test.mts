import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultRules, ENTITY_TYPES, startingRules, SUGGESTION_MIN_RECORDS } from './entity-types'

test('every type starts with no rules (PairSight suggests) once it has enough records', () => {
	for (const type of ENTITY_TYPES) {
		assert.deepEqual(startingRules(type), [])
		assert.deepEqual(startingRules(type, SUGGESTION_MIN_RECORDS), [])
		// Too few records to learn from: the simple rules, saved and on.
		assert.ok(defaultRules(type).length > 0)
		assert.deepEqual(startingRules(type, SUGGESTION_MIN_RECORDS - 1), defaultRules(type))
	}
})
