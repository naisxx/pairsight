import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	ESTIMATE_BUFFER,
	estimateRunDuration,
	fallbackRate,
	MIN_CHECKS_FOR_SPEED,
	rateFromHistory,
	SECONDS_PER_CALL
} from './run-estimate'

test('the speed is recent runs taken together, big runs counting for more', () => {
	assert.equal(rateFromHistory([]), null)
	assert.equal(rateFromHistory([{ newChecks: MIN_CHECKS_FOR_SPEED - 1, seconds: 1 }]), null)
	assert.equal(rateFromHistory([{ newChecks: 1_000, seconds: 0 }]), null)
	assert.equal(
		rateFromHistory([
			{ newChecks: 1_000, seconds: 10 },
			{ newChecks: 2_000, seconds: 10 }
		]),
		150
	)
	// A 100K run at 360/s and two small ones at 30/s (mostly start-up):
	// the big run sets the speed.
	const rate = rateFromHistory([
		{ newChecks: 100_000, seconds: 278 },
		{ newChecks: 435, seconds: 14 },
		{ newChecks: 435, seconds: 14 }
	])
	assert.ok(rate != null && rate > 300, `got ${rate}`)
})

test('with no history, the speed comes from calls at once and the measured call time', () => {
	assert.equal(fallbackRate(100), 100 / SECONDS_PER_CALL)
	assert.equal(fallbackRate(0), 1 / SECONDS_PER_CALL)
})

test('the estimate is padded by 30% and rounded up', () => {
	assert.equal(ESTIMATE_BUFFER, 1.3)
	assert.deepEqual(estimateRunDuration({ newChecks: 0, pairsPerSecond: 100 }), { unit: 'none' })
	// 4,000 at 100/s = 40 s, padded to 52 s.
	assert.deepEqual(estimateRunDuration({ newChecks: 4_000, pairsPerSecond: 100 }), {
		unit: 'underMinute'
	})
	// 5,000 at 100/s = 50 s, padded to 65 s: 2 minutes, rounded up.
	assert.deepEqual(estimateRunDuration({ newChecks: 5_000, pairsPerSecond: 100 }), {
		unit: 'minutes',
		value: 2
	})
	// 100,000 at 200/s = 500 s, padded to 650 s: 11 minutes.
	assert.deepEqual(estimateRunDuration({ newChecks: 100_000, pairsPerSecond: 200 }), {
		unit: 'minutes',
		value: 11
	})
	// 1,000,000 at 100/s ≈ 2.8 h, padded to ≈ 3.6 h: 4 hours.
	assert.deepEqual(estimateRunDuration({ newChecks: 1_000_000, pairsPerSecond: 100 }), {
		unit: 'hours',
		value: 4
	})
})
