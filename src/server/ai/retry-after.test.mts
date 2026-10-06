import { test } from 'node:test'
import assert from 'node:assert/strict'
import { retryAfterMs } from './retry-after'

test('Retry-After reads as seconds or an HTTP date, else nothing', () => {
	const now = Date.parse('2026-10-06T12:00:00Z')
	assert.equal(retryAfterMs(null, now), null)
	assert.equal(retryAfterMs('', now), null)
	assert.equal(retryAfterMs(' 30 ', now), 30_000)
	assert.equal(retryAfterMs('0', now), 0)
	assert.equal(retryAfterMs('Tue, 06 Oct 2026 12:00:45 GMT', now), 45_000)
	assert.equal(retryAfterMs('Tue, 06 Oct 2026 11:59:00 GMT', now), null)
	assert.equal(retryAfterMs('soon', now), null)
	assert.equal(retryAfterMs('-5', now), null)
})
