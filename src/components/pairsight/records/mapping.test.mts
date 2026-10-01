import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	assignColumn,
	fieldFor,
	fieldKeys,
	sameMapping,
	savedMapping,
	suggestedMapping,
	toColumnRoles
} from './mapping'

const headers = ['id', 'name', 'email', 'email2', 'notes']

test('fieldKeys puts the reference first and leaves out "other"', () => {
	assert.deepEqual(fieldKeys(['full_name', 'email', 'other']), ['reference', 'full_name', 'email'])
})

test('suggestedMapping takes the first column suggested for each role', () => {
	const mapping = suggestedMapping({
		headers,
		suggestedReference: 'id',
		suggestedRoles: {
			id: 'other',
			name: 'full_name',
			email: 'email',
			email2: 'email',
			notes: 'other'
		}
	})
	assert.deepEqual(
		[...mapping],
		[
			['reference', 'id'],
			['full_name', 'name'],
			['email', 'email']
		]
	)
})

test('assignColumn moves a column off the field that had it', () => {
	const start = new Map([
		['reference', 'id'],
		['email', 'email']
	] as const)
	const moved = assignColumn(start, 'full_name', 'email')
	assert.equal(moved.get('full_name'), 'email')
	assert.equal(moved.has('email'), false)
	assert.equal(fieldFor(moved, 'email'), 'full_name')
	assert.equal(assignColumn(moved, 'full_name', null).has('full_name'), false)
})

test('toColumnRoles gives every non-reference column a role, "other" when unmapped', () => {
	const mapping = new Map([
		['reference', 'id'],
		['full_name', 'name'],
		['email', 'email2']
	] as const)
	assert.deepEqual(toColumnRoles(mapping, headers), {
		name: 'full_name',
		email: 'other',
		email2: 'email',
		notes: 'other'
	})
})

test('savedMapping reads a stored dataset back into the same shape', () => {
	const mapping = savedMapping({
		referenceColumn: 'id',
		columnRoles: { name: 'full_name', email: 'email', notes: 'other' }
	})
	assert.ok(
		sameMapping(
			mapping,
			new Map([
				['reference', 'id'],
				['full_name', 'name'],
				['email', 'email']
			] as const)
		)
	)
})
