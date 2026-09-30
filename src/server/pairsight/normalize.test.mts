import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEmail, normalizePhone, normalizePostcode, normalizeText } from './normalize'

test('email is trimmed and lowercased, keeping dots and +tags', () => {
	assert.equal(normalizeEmail('  Jane.Smith+crm@Mail.COM '), 'jane.smith+crm@mail.com')
	assert.equal(normalizeEmail('   '), null)
})

test('phone normalizes to E.164 using the country, and unusable numbers give no key', () => {
	assert.equal(normalizePhone('(415) 555-0101', 'US'), '+14155550101')
	assert.equal(normalizePhone('+1 415 555 0101', 'GB'), '+14155550101')
	assert.equal(normalizePhone('020 7946 0018', 'gb'), '+442079460018')
	assert.equal(normalizePhone('12', 'US'), null)
	assert.equal(normalizePhone('4155550101', 'ZZ'), null)
	assert.equal(normalizePhone('', 'US'), null)
})

test('names collapse whitespace and case; postcodes drop spaces', () => {
	assert.equal(normalizeText('  Jane   SMITH '), 'jane smith')
	assert.equal(normalizePostcode(' sw1a 1aa '), 'SW1A1AA')
})
