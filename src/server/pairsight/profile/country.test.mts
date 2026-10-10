import { test } from 'node:test'
import assert from 'node:assert/strict'
import { regionFor } from './country'

test('a country cell reads as its code: codes, English names and common aliases', () => {
	assert.equal(regionFor('IE', 'GB'), 'IE')
	assert.equal(regionFor('ie', 'GB'), 'IE')
	assert.equal(regionFor('Ireland', 'GB'), 'IE')
	assert.equal(regionFor(' united  states ', 'GB'), 'US')
	assert.equal(regionFor('USA', 'GB'), 'US')
	assert.equal(regionFor('Scotland', 'US'), 'GB')
	assert.equal(regionFor('Germany', 'GB'), 'DE')
})

test('blank or unknown: the evaluation’s country', () => {
	assert.equal(regionFor(undefined, 'GB'), 'GB')
	assert.equal(regionFor('  ', 'US'), 'US')
	assert.equal(regionFor('Atlantis', 'GB'), 'GB')
})
