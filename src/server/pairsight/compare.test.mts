import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareFields } from './compare'

const columnRoles = {
	first_name: 'first_name',
	email: 'email',
	phone: 'phone',
	dob: 'date_of_birth',
	notes: 'other'
} as const

test('fields compare after normalization, and missing values are distinguished', () => {
	const { fields, otherHeaders } = compareFields({
		valuesA: {
			first_name: 'Jane',
			email: 'Jane.Smith@Example.com',
			phone: '(415) 555-0101',
			dob: '',
			notes: 'x'
		},
		valuesB: {
			first_name: 'Janet',
			email: 'jane.smith@example.com',
			phone: '',
			dob: '',
			notes: 'y'
		},
		columnRoles: { ...columnRoles },
		country: 'US'
	})
	assert.deepEqual(
		fields.map((field) => [field.role, field.comparison]),
		[
			['first_name', 'different'],
			['email', 'same'],
			['phone', 'oneMissing'],
			['date_of_birth', 'bothMissing']
		]
	)
	// The emails match only once case is normalized: written differently.
	assert.equal(fields.find((field) => field.role === 'email')?.isFormatOnly, true)
	// Unmapped columns are kept for "All columns", never compared.
	assert.deepEqual(otherHeaders, ['notes'])
})
