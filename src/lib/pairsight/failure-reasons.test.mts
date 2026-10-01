import assert from 'node:assert/strict'
import { test } from 'node:test'
import { failureReason } from './failure-reasons'

test('HTTP codes map to what went wrong, not the number', () => {
	assert.equal(failureReason('http_422'), 'rejected')
	assert.equal(failureReason('http_400'), 'rejected')
	assert.equal(failureReason('http_429'), 'rate_limited')
	assert.equal(failureReason('http_529'), 'unavailable')
	assert.equal(failureReason('http_503'), 'unavailable')
})

test('transport and parsing failures keep their own reason', () => {
	assert.equal(failureReason('timeout'), 'timeout')
	assert.equal(failureReason('network'), 'network')
	assert.equal(failureReason('invalid_response'), 'invalid_response')
})

test('anything unrecognised is unknown, never a guess', () => {
	assert.equal(failureReason('unexpected'), 'unknown')
	assert.equal(failureReason(null), 'unknown')
	assert.equal(failureReason('http_abc'), 'unknown')
})
