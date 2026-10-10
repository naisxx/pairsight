import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dateOrderEvidence, parseDate } from './dates'

const NOW = new Date('2026-10-10T00:00:00Z')

test('ISO dates read as they are, with or without a time', () => {
	assert.equal(parseDate('1990-04-12', null, NOW), '1990-04-12')
	assert.equal(parseDate('1990-4-2', 'mdy', NOW), '1990-04-02')
	assert.equal(parseDate('1990-04-12T00:00:00Z', null, NOW), '1990-04-12')
	assert.equal(parseDate('1990-04-12 13:45', null, NOW), '1990-04-12')
})

test('numeric dates follow the column’s order', () => {
	assert.equal(parseDate('04/05/1990', 'dmy', NOW), '1990-05-04')
	assert.equal(parseDate('04/05/1990', 'mdy', NOW), '1990-04-05')
	assert.equal(parseDate('4.5.1990', 'dmy', NOW), '1990-05-04')
	assert.equal(parseDate('04-05-1990', 'dmy', NOW), '1990-05-04')
	// No order settled: day first, unless only month first makes sense.
	assert.equal(parseDate('04/05/1990', null, NOW), '1990-05-04')
	assert.equal(parseDate('04/25/1990', null, NOW), '1990-04-25')
})

test('month names, short or long, either way round', () => {
	assert.equal(parseDate('12 Apr 1990', null, NOW), '1990-04-12')
	assert.equal(parseDate('12th April 1990', null, NOW), '1990-04-12')
	assert.equal(parseDate('12-sept-1990', null, NOW), '1990-09-12')
	assert.equal(parseDate('April 12, 1990', null, NOW), '1990-04-12')
	assert.equal(parseDate('Apr. 12 1990', null, NOW), '1990-04-12')
})

test('two-digit years are never in the future', () => {
	assert.equal(parseDate('12/04/90', 'dmy', NOW), '1990-04-12')
	assert.equal(parseDate('12/04/05', 'dmy', NOW), '2005-04-12')
	assert.equal(parseDate('12/04/26', 'dmy', NOW), '2026-04-12')
	assert.equal(parseDate('12/04/27', 'dmy', NOW), '1927-04-12')
})

test('impossible dates and other text are not dates', () => {
	assert.equal(parseDate('31/04/1990', 'dmy', NOW), null)
	assert.equal(parseDate('29/02/1991', 'dmy', NOW), null)
	assert.equal(parseDate('29/02/1992', 'dmy', NOW), '1992-02-29')
	assert.equal(parseDate('13/13/1990', 'dmy', NOW), null)
	assert.equal(parseDate('12 Smarch 1990', null, NOW), null)
	assert.equal(parseDate('unknown', null, NOW), null)
})

test('only a part above 12 says which way round a date is', () => {
	assert.equal(dateOrderEvidence('25/12/1990'), 'dmy')
	assert.equal(dateOrderEvidence('12/25/1990'), 'mdy')
	assert.equal(dateOrderEvidence('04/05/1990'), null)
	assert.equal(dateOrderEvidence('1990-12-25'), null)
})
