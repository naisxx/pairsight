import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	defaultRules,
	startingRules,
	SUGGESTED_TYPES,
	SUGGESTION_MIN_RECORDS
} from './entity-types'

test('people start with no rules (PairSight suggests); other types start with their defaults', () => {
	assert.ok(SUGGESTED_TYPES.includes('person'))
	assert.deepEqual(startingRules('person'), [])
	assert.deepEqual(startingRules('company'), defaultRules('company'))
	assert.deepEqual(startingRules('product'), defaultRules('product'))
	assert.ok(defaultRules('person').length > 0)
	// Too few records to learn from: the simple rules, saved and on.
	assert.deepEqual(startingRules('person', SUGGESTION_MIN_RECORDS - 1), defaultRules('person'))
	assert.deepEqual(startingRules('person', SUGGESTION_MIN_RECORDS), [])
})
