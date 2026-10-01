import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FULL_NAME_MAX_LENGTH, fullNameSchema, initialsOf } from './profile'
import { safeNext } from './safe-next'

test('a full name is required, trimmed and capped', () => {
	assert.equal(fullNameSchema.safeParse('   ').success, false)
	assert.equal(fullNameSchema.parse('  Ana López  '), 'Ana López')
	assert.equal(fullNameSchema.safeParse('a'.repeat(FULL_NAME_MAX_LENGTH + 1)).success, false)
})

test('initials come from the first two words, whatever the spacing', () => {
	assert.equal(initialsOf('Ana María López'), 'AM')
	assert.equal(initialsOf('  prince  '), 'P')
	assert.equal(initialsOf('élodie durand'), 'ÉD')
})

test('only same-site paths are followed after onboarding', () => {
	assert.equal(safeNext('/evaluations/abc/records'), '/evaluations/abc/records')
	assert.equal(safeNext('//evil.example'), '/evaluations')
	assert.equal(safeNext('/\\evil.example'), '/evaluations')
	assert.equal(safeNext('https://evil.example'), '/evaluations')
	assert.equal(safeNext(undefined), '/evaluations')
})
