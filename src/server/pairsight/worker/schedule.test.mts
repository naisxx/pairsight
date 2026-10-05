import { test } from 'node:test'
import assert from 'node:assert/strict'
import { batchSizeFor, createReportOnce, shareConcurrency } from './schedule'

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

test('a batch is two rounds of the run’s share', () => {
	assert.equal(batchSizeFor(20), 40)
	assert.equal(batchSizeFor(0), 2)
})

test('an unexpected failure is reported once per run and kind', () => {
	const reportOnce = createReportOnce()
	assert.equal(reportOnce('run-1', 'TypeError'), true)
	assert.equal(reportOnce('run-1', 'TypeError'), false)
	assert.equal(reportOnce('run-1', 'RangeError'), true)
	assert.equal(reportOnce('run-2', 'TypeError'), true)
})
