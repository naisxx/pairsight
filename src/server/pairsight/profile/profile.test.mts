import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { MappedFields } from '../normalize'
import { datasetProfileSchema, parseProfile, profileRecords } from './profile'

const TODAY = '2026-10-10'
const people = (count: number, make: (index: number) => MappedFields) =>
	Array.from({ length: count }, (_, index) => make(index))

test('each mapped field: how full it is, how varied, and its commonest values', () => {
	const profile = profileRecords(
		people(200, (index) => ({
			first_name: index % 2 === 0 ? 'Jane' : 'John',
			email: index < 150 ? `p${index}@mail.example` : undefined
		})),
		{ type: 'person', country: 'GB', today: TODAY }
	)
	assert.equal(profile.records, 200)
	assert.equal(profile.fields.first_name?.filled, 200)
	assert.equal(profile.fields.first_name?.distinct, 2)
	assert.deepEqual(
		profile.fields.first_name?.top.map(({ shown, count }) => [shown, count]),
		[
			['Jane', 100],
			['John', 100]
		]
	)
	assert.equal(profile.fields.email?.filled, 150)
	assert.equal(profile.fields.phone, undefined)
	assert.ok(datasetProfileSchema.safeParse(profile).success)
})

test('a column half "N/A": every filler is listed with its count', () => {
	const profile = profileRecords(
		people(200, (index) => ({
			email: index % 2 === 0 ? 'N/A' : index % 3 === 0 ? 'test@test.com' : `p${index}@mail.example`
		})),
		{ type: 'person', country: 'GB', today: TODAY }
	)
	const listed = profile.fields.email?.placeholders ?? []
	assert.deepEqual(
		listed.map(({ shown, count, reason }) => [shown, count, reason]),
		[
			['N/A', 100, 'filler'],
			['test@test.com', 33, 'filler']
		]
	)
	// Fillers aren't counted as unreadable: they're known for what they are.
	assert.equal(profile.fields.email?.unreadable, 0)
})

test('a shared number is overused; a shared city is just common', () => {
	const profile = profileRecords(
		people(200, (index) => ({
			phone: index < 20 ? '0113 496 0000' : `07700 9${String(index).padStart(5, '0')}`,
			city: index < 150 ? 'Leeds' : 'York'
		})),
		{ type: 'person', country: 'GB', today: TODAY }
	)
	assert.deepEqual(
		profile.fields.phone?.placeholders.map(({ value, count, reason }) => [value, count, reason]),
		[['+441134960000', 20, 'overused']]
	)
	assert.deepEqual(profile.fields.city?.placeholders, [])
})

test('too few sharing a number is no sign of anything', () => {
	const profile = profileRecords(
		people(200, (index) => ({
			phone: index < 9 ? '0113 496 0000' : `07700 9${String(index).padStart(5, '0')}`
		})),
		{ type: 'person', country: 'GB', today: TODAY }
	)
	assert.deepEqual(profile.fields.phone?.placeholders, [])
})

test('1900 and future dates of birth are fillers, however written', () => {
	const profile = profileRecords(
		[
			{ date_of_birth: '01/01/1900' },
			{ date_of_birth: '1 Jan 1900' },
			{ date_of_birth: '25/12/2030' },
			{ date_of_birth: '25/12/1990' }
		],
		{ type: 'person', country: 'GB', today: TODAY }
	)
	assert.deepEqual(
		profile.fields.date_of_birth?.placeholders.map(({ value, count }) => [value, count]),
		[
			['1900-01-01', 2],
			['2030-12-25', 1]
		]
	)
})

test('date order: settled by a part above 12, else the evaluation’s country', () => {
	const order = (dates: string[], country: string) =>
		profileRecords(
			dates.map((date_of_birth) => ({ date_of_birth })),
			{ type: 'person', country, today: TODAY }
		).dates
	assert.deepEqual(order(['04/05/1990', '25/12/1990'], 'US'), { order: 'dmy', assumed: false })
	assert.deepEqual(order(['04/05/1990', '12/25/1990'], 'GB'), { order: 'mdy', assumed: false })
	assert.deepEqual(order(['04/05/1990'], 'US'), { order: 'mdy', assumed: true })
	assert.deepEqual(order(['04/05/1990'], 'GB'), { order: 'dmy', assumed: true })
	assert.deepEqual(order(['1990-05-04'], 'GB'), { order: null, assumed: false })
})

test('unreadable values: a phone, an email or a date that isn’t one', () => {
	const profile = profileRecords(
		[
			{ phone: '0800 12', email: 'jane at mail', date_of_birth: 'sometime' },
			{ phone: '07700 900123', email: 'jane@mail.example', date_of_birth: '1990-01-02' }
		],
		{ type: 'person', country: 'GB', today: TODAY }
	)
	assert.equal(profile.fields.phone?.unreadable, 1)
	assert.equal(profile.fields.email?.unreadable, 1)
	assert.equal(profile.fields.date_of_birth?.unreadable, 1)
})

test('a file with no date of birth, and fields of other types left out', () => {
	const profile = profileRecords([{ company_name: 'Acme Ltd', first_name: 'Jane' }], {
		type: 'company',
		country: 'GB',
		today: TODAY
	})
	assert.deepEqual(profile.dates, { order: null, assumed: false })
	assert.ok(profile.fields.company_name != null)
	assert.equal(profile.fields.first_name, undefined)
})

test('a stored profile of another shape reads as none', () => {
	assert.equal(parseProfile(null), null)
	assert.equal(parseProfile({ version: 0 }), null)
	const profile = profileRecords([], { type: 'person', country: 'GB', today: TODAY })
	assert.deepEqual(parseProfile(JSON.parse(JSON.stringify(profile))), profile)
})
