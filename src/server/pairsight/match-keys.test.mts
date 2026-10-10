import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchKey } from './match-keys'
import { normalizeField } from './normalize'
import type { KeyField } from '@/lib/pairsight/entity-types'
import type { MappedFields } from './normalize'
import { keyContextFor, profileRecords } from './profile/profile'

// A file with nothing to settle: no placeholders, no numeric dates.
const context = (country = 'GB') =>
	keyContextFor(profileRecords([], { type: 'person', country }), { today: '2026-10-10' })
const key = (field: KeyField, fields: MappedFields, country = 'GB') =>
	matchKey({ field, fields, context: context(country) })

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

test('birth year from common date formats, two-digit years included', () => {
	assert.equal(key('date_of_birth~year', { date_of_birth: '1990-04-12' }), '1990')
	assert.equal(key('date_of_birth~year', { date_of_birth: '12/04/1990' }), '1990')
	assert.equal(key('date_of_birth~year', { date_of_birth: '12 Apr 1990' }), '1990')
	assert.equal(key('date_of_birth~year', { date_of_birth: '12/04/90' }), '1990')
	assert.equal(key('date_of_birth~year', { date_of_birth: 'sometime' }), null)
})

test('a date of birth keys as one ISO date, in the order the file writes it', () => {
	const dayFirst = profileRecords(
		[{ date_of_birth: '25/12/1990' }, { date_of_birth: '04/05/1990' }],
		{ type: 'person', country: 'US', today: '2026-10-10' }
	)
	const read = (value: string) =>
		matchKey({
			field: 'date_of_birth',
			fields: { date_of_birth: value },
			context: keyContextFor(dayFirst, { today: '2026-10-10' })
		})
	// One day above 12 settles it, even in a US evaluation.
	assert.equal(read('04/05/1990'), '1990-05-04')
	assert.equal(read('4 May 1990'), '1990-05-04')
	assert.equal(read('1990-05-04'), '1990-05-04')
})

test('a stand-in for "not known" blanks the field and every key from it', () => {
	assert.equal(key('email', { email: 'N/A' }), null)
	assert.equal(key('email~local', { email: 'test@test.com' }), null)
	assert.equal(key('phone', { phone: '00000000000' }), null)
	assert.equal(key('phone~last7', { phone: '0000000000' }), null)
	assert.equal(key('date_of_birth~year', { date_of_birth: '01/01/1900' }), null)
	// A name loses only the unmistakable ones: Na is a surname.
	assert.equal(key('last_name', { last_name: 'Unknown' }), null)
	assert.equal(key('last_name', { last_name: 'Na' }), 'na')
})

test('a value too many records share is blanked: a switchboard is no identity', () => {
	const people = Array.from({ length: 200 }, (_, index) => ({
		phone: index < 20 ? '0113 496 0000' : `07700 9${String(index).padStart(5, '0')}`,
		city: index < 150 ? 'Leeds' : 'York'
	}))
	const profile = profileRecords(people, { type: 'person', country: 'GB', today: '2026-10-10' })
	const read = (field: KeyField, fields: MappedFields) =>
		matchKey({ field, fields, context: keyContextFor(profile, { today: '2026-10-10' }) })
	// Written another way, it's still the shared number.
	assert.equal(read('phone', { phone: '01134960000' }), null)
	assert.equal(read('phone~last7', { phone: '0113 496 0000' }), null)
	assert.equal(read('phone', { phone: '07700 900021' }), '+447700900021')
	// A common city is just a common city.
	assert.equal(read('city', { city: 'Leeds' }), 'leeds')
})

test('a phone is read for the record’s own country, and a lost leading 0 is put back', () => {
	assert.equal(key('phone', { phone: '087 123 4567', country: 'Ireland' }), '+353871234567')
	assert.equal(key('phone', { phone: '+353 87 123 4567' }), '+353871234567')
	assert.equal(key('phone', { phone: '087 123 4567', country: 'IE' }), '+353871234567')
	// Unknown country: the evaluation's.
	assert.equal(key('phone', { phone: '07700 900123', country: 'Atlantis' }), '+447700900123')
	assert.equal(key('phone', { phone: '7700900123' }), '+447700900123')
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
