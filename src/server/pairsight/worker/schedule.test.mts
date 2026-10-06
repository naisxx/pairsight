import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createReportOnce, shareConcurrency, shouldRefill } from './schedule'

test('Jev calls are shared evenly across running runs, the oldest first', () => {
	assert.deepEqual(shareConcurrency(40, 1), [40])
	assert.deepEqual(shareConcurrency(40, 3), [14, 13, 13])
	assert.deepEqual(shareConcurrency(40, 4), [10, 10, 10, 10])
	assert.equal(
		shareConcurrency(40, 3).reduce((sum, share) => sum + share, 0),
		40
	)
})

test('every run gets at least one call, even with more runs than calls', () => {
	assert.deepEqual(shareConcurrency(2, 3), [1, 1, 1])
	assert.deepEqual(shareConcurrency(40, 0), [])
})

test('more pairs start once a quarter of the run’s calls are back, or none are out', () => {
	assert.equal(shouldRefill({ share: 100, inFlight: 0 }), true)
	assert.equal(shouldRefill({ share: 100, inFlight: 76 }), false)
	assert.equal(shouldRefill({ share: 100, inFlight: 75 }), true)
	// One stuck call never stops the rest being topped up.
	assert.equal(shouldRefill({ share: 100, inFlight: 1 }), true)
	assert.equal(shouldRefill({ share: 1, inFlight: 0 }), true)
	assert.equal(shouldRefill({ share: 1, inFlight: 1 }), false)
	// The shared limit shrank below what's already out: wait.
	assert.equal(shouldRefill({ share: 10, inFlight: 40 }), false)
})

test('an unexpected failure is reported once per run and kind', () => {
	const reportOnce = createReportOnce()
	assert.equal(reportOnce('run-1', 'TypeError'), true)
	assert.equal(reportOnce('run-1', 'TypeError'), false)
	assert.equal(reportOnce('run-1', 'RangeError'), true)
	assert.equal(reportOnce('run-2', 'TypeError'), true)
})
