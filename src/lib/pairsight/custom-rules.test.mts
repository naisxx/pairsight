import { test } from 'node:test'
import assert from 'node:assert/strict'
import { customRule, hasSameFields, isCustomRuleId } from './custom-rules'

test('a custom rule is the same rule whatever order its fields were picked in', () => {
	assert.deepEqual(customRule(['postcode', 'last_name']), {
		id: 'custom_last_name_postcode',
		fields: ['last_name', 'postcode']
	})
	assert.equal(customRule(['last_name', 'postcode']).id, customRule(['postcode', 'last_name']).id)
	assert.equal(isCustomRuleId(customRule(['email']).id), true)
	assert.equal(isCustomRuleId('email'), false)
})

test('duplicates are caught by fields, including against presets', () => {
	assert.equal(hasSameFields(['postcode', 'name'], ['name', 'postcode']), true)
	assert.equal(hasSameFields(['email'], ['email', 'phone']), false)
	assert.equal(hasSameFields(['date_of_birth', 'last_name'], ['last_name', 'city']), false)
})

test('a rule id stays within the stored limit even with three long fields', () => {
	const longest = customRule(['date_of_birth', 'first_name', 'last_name'])
	assert.ok(longest.id.length <= 64, longest.id)
})
