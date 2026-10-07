import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchKey } from './match-keys'
import { normalizeField } from './normalize'
import type { KeyField } from '@/lib/pairsight/entity-types'
import type { MappedFields } from './normalize'

const key = (field: KeyField, fields: MappedFields, country = 'GB') =>
	matchKey({ field, fields, country })

test('a plain field keys exactly as normalizeField cleans it', () => {
	const fields = { email: ' Jane@X.com ', phone: '07700 900123', last_name: 'Smith' }
	for (const field of ['email', 'phone', 'last_name'] as const) {
		assert.equal(key(field, fields), normalizeField({ field, fields, country: 'GB' }))
	}
	assert.equal(key('name', { first_name: 'Jane', last_name: 'Smith' }), 'jane smith')
})

test('sounds like: spelling variants share a key', () => {
	assert.equal(
		key('last_name~sound', { last_name: 'Smith' }),
		key('last_name~sound', { last_name: 'Smyth' })
	)
	assert.equal(
		key('name~sound', { full_name: 'Jon Smyth' }),
		key('name~sound', { full_name: 'John Smith' })
	)
	assert.equal(
		key('first_name~sound', { first_name: 'Catherine' }),
		key('first_name~sound', { first_name: 'Kathryn' })
	)
	assert.notEqual(
		key('last_name~sound', { last_name: 'Smith' }),
		key('last_name~sound', { last_name: 'Jones' })
	)
	assert.equal(key('last_name~sound', { last_name: '  ' }), null)
})

test('words in any order: swapped and repeated words share a key', () => {
	assert.equal(
		key('name~words', { full_name: 'Smith Jane' }),
		key('name~words', { full_name: 'Jane  Smith' })
	)
	assert.equal(
		key('company_name~words', { company_name: 'Traders Brightwater Ltd' }),
		key('company_name~words', { company_name: 'Brightwater Traders' })
	)
})

test('first letters and the first initial', () => {
	assert.equal(key('last_name~prefix', { last_name: "O'Brien-Smith" }), 'obri')
	assert.equal(key('last_name~prefix', { last_name: 'Li' }), 'li')
	assert.equal(key('first_name~initial', { first_name: 'élodie' }), 'e')
})

test('email username drops a +tag; the domain is kept apart', () => {
	assert.equal(key('email~local', { email: 'J.Smith+shop@gmail.com' }), 'j.smith')
	assert.equal(key('email~local', { email: 'j.smith@outlook.com' }), 'j.smith')
	assert.equal(key('email~domain', { email: 'J.Smith@Gmail.com' }), 'gmail.com')
	assert.equal(key('email~local', { email: 'not-an-email' }), null)
})

test('birth year from common date formats', () => {
	assert.equal(key('date_of_birth~year', { date_of_birth: '1990-04-12' }), '1990')
	assert.equal(key('date_of_birth~year', { date_of_birth: '12/04/1990' }), '1990')
	assert.equal(key('date_of_birth~year', { date_of_birth: '12/04/90' }), null)
})

test('postcode district: the UK outward code, else the first three characters', () => {
	assert.equal(key('postcode~district', { postcode: 'SW1A 1AA' }), 'SW1A')
	assert.equal(key('postcode~district', { postcode: 'm1 1ae' }), 'M1')
	assert.equal(key('postcode~district', { postcode: 'EC1A1BB' }), 'EC1A')
	assert.equal(key('postcode~district', { postcode: '94110' }), '941')
})

test('phone tail: the same number with or without its country code', () => {
	const local = key('phone~last7', { phone: '07700 900123' }, 'US')
	assert.equal(local, '0900123')
	assert.equal(key('phone~last7', { phone: '+44 7700 900123' }, 'US'), local)
	assert.equal(key('phone~last7', { phone: '12345' }), null)
})
