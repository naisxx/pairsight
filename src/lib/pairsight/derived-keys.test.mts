import { test } from 'node:test'
import assert from 'node:assert/strict'
import { customRule } from './custom-rules'
import {
	DERIVED_FIELDS,
	isFuzzyRule,
	needsPartner,
	parseRuleField,
	transformsFor
} from './derived-keys'
import { missingField } from './rule-fields'
import { blockingRuleSchema } from '../../server/pairsight/schemas'

test('derived fields are field~transform, and parse back', () => {
	assert.ok(DERIVED_FIELDS.includes('last_name~sound'))
	assert.deepEqual(parseRuleField('last_name~sound'), { base: 'last_name', transform: 'sound' })
	assert.deepEqual(parseRuleField('email'), { base: 'email', transform: null })
	assert.deepEqual(transformsFor('email'), ['local', 'domain'])
	assert.deepEqual(transformsFor('city'), [])
})

test('too-broad fields need a partner', () => {
	assert.equal(needsPartner(['date_of_birth~year']), true)
	assert.equal(needsPartner(['date_of_birth~year', 'postcode~district']), true)
	assert.equal(needsPartner(['date_of_birth~year', 'last_name~sound']), false)
	assert.equal(needsPartner(['email~local']), false)
	assert.equal(needsPartner(['email']), false)
})

test('a rule is fuzzy when any field is derived', () => {
	assert.equal(isFuzzyRule({ fields: ['name', 'postcode'] }), false)
	assert.equal(isFuzzyRule({ fields: ['name~sound', 'postcode'] }), true)
})

test('custom rule ids stay canonical with derived fields', () => {
	const a = customRule(['date_of_birth~year', 'last_name~sound'])
	const b = customRule(['last_name~sound', 'date_of_birth~year'])
	assert.equal(a.id, b.id)
	assert.deepEqual(a.fields, b.fields)
	assert.equal(customRule(['last_name', 'last_name~sound']).fields.length, 2)
})

test('a derived field needs the field it comes from mapped', () => {
	assert.equal(missingField(['last_name~sound'], new Set(['first_name'])), 'last_name')
	assert.equal(missingField(['last_name~sound'], new Set(['last_name'])), null)
	assert.equal(missingField(['name~sound'], new Set(['first_name', 'last_name'])), null)
})

test('the rule schema takes derived fields and refuses a too-broad rule', () => {
	assert.ok(blockingRuleSchema.safeParse({ id: 'r', fields: ['last_name~sound'] }).success)
	assert.ok(
		blockingRuleSchema.safeParse({ id: 'r', fields: ['date_of_birth~year', 'last_name~sound'] })
			.success
	)
	assert.equal(
		blockingRuleSchema.safeParse({ id: 'r', fields: ['date_of_birth~year'] }).success,
		false
	)
	assert.equal(blockingRuleSchema.safeParse({ id: 'r', fields: ['email~year'] }).success, false)
	assert.equal(blockingRuleSchema.safeParse({ id: 'r', fields: ['email~nope'] }).success, false)
})
