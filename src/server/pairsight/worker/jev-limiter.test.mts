import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	DEFAULT_SETTINGS,
	gate,
	JevLimiter,
	limiterState,
	onAnswer,
	onBusy,
	type LimiterSettings,
	type LimiterState
} from './jev-limiter'

const settings: LimiterSettings = { ...DEFAULT_SETTINGS, start: 100, max: 200 }

function answers(state: LimiterState, count: number) {
	let next = state
	for (let index = 0; index < count; index++) next = onAnswer(next, settings)
	return next
}

test('starts at the start, climbs a step per window of clean answers, up to the max', () => {
	const start = limiterState(settings)
	assert.equal(start.limit, 100)
	assert.equal(answers(start, 99).limit, 100)
	assert.equal(answers(start, 100).limit, 104)
	// A window is the current limit: the next step needs 104 more.
	assert.equal(answers(start, 100 + 103).limit, 104)
	assert.equal(answers(start, 100 + 104).limit, 108)
	assert.equal(answers(start, 100_000).limit, 200)
})

test('pushback halves the limit once per burst, down to the floor', () => {
	const busy = onBusy(limiterState(settings), settings, 0, null)
	assert.equal(busy.limit, 50)
	// The same burst a moment later: no second cut.
	assert.equal(onBusy(busy, settings, 1_000, null).limit, 50)
	// A new burst after the cooldown: halved again.
	assert.equal(onBusy(busy, settings, settings.cutCooldownMs, null).limit, 25)
	let state = limiterState(settings)
	for (let index = 0; index < 20; index++) {
		state = onBusy(state, settings, index * settings.cutCooldownMs, null)
		state = { ...state, breaker: 'closed' }
	}
	assert.equal(state.limit, settings.floor)
})

test('many busy answers in a row open the breaker; then one probe decides', () => {
	let state = limiterState(settings)
	for (let index = 0; index < settings.tripAfter - 1; index++) {
		state = onBusy(state, settings, 0, null)
	}
	assert.equal(state.breaker, 'closed')
	state = onBusy(state, settings, 0, null)
	assert.equal(state.breaker, 'open')
	assert.equal(state.openUntil, settings.openMinMs)

	// Nothing goes out while it's open.
	assert.deepEqual(gate(state, 1_000).slots, 0)
	assert.equal(gate(state, 1_000).until, settings.openMinMs)
	// Time's up: one probe.
	const probing = gate(state, settings.openMinMs)
	assert.equal(probing.slots, 1)
	assert.equal(probing.state.breaker, 'probing')

	// The probe is busy too: open again, for twice as long.
	const reopened = onBusy(probing.state, settings, settings.openMinMs, null)
	assert.equal(reopened.breaker, 'open')
	assert.equal(reopened.openUntil, settings.openMinMs + 2 * settings.openMinMs)

	// The next probe is answered: closed, calls flow at the limit again.
	const answered = onAnswer(gate(reopened, reopened.openUntil).state, settings)
	assert.equal(answered.breaker, 'closed')
	assert.equal(answered.openFor, 0)
	assert.equal(gate(answered, reopened.openUntil).slots, answered.limit)
})

test('an outage of any length only stretches the wait, up to the cap', () => {
	let state = onBusy(limiterState(settings), settings, 0, 1)
	let now = 0
	for (let index = 0; index < 20; index++) {
		now = state.openUntil
		state = onBusy(gate(state, now).state, settings, now, null)
	}
	assert.equal(state.breaker, 'open')
	assert.equal(state.openUntil - now, settings.openMaxMs)
})

test('Jev naming a time to come back opens the breaker until then, at least', () => {
	const state = onBusy(limiterState(settings), settings, 1_000, 30_000)
	assert.equal(state.breaker, 'open')
	assert.equal(state.openUntil, 31_000)
	// A shorter Retry-After never shortens the backoff.
	assert.equal(onBusy(limiterState(settings), settings, 0, 1_000).openUntil, settings.openMinMs)
	// While open, a later, longer one pushes the reopening back; a shorter one doesn't.
	assert.equal(onBusy(state, settings, 2_000, 60_000).openUntil, 62_000)
	assert.equal(onBusy(state, settings, 2_000, 1_000).openUntil, 31_000)
})

test('the slots hold calls back while the breaker is open and let them through after', async () => {
	let now = 0
	const limiter = new JevLimiter({ ...settings, start: 2, openMinMs: 20 }, () => now)
	const first = await limiter.acquire()
	const second = await limiter.acquire()
	let thirdIn = false
	const third = limiter.acquire().then((release) => {
		thirdIn = true
		return release
	})
	await Promise.resolve()
	assert.equal(thirdIn, false, 'only `limit` calls at once')
	first()
	await third
	assert.equal(thirdIn, true)

	// Jev asks us to wait: nothing new starts until it's time.
	limiter.busy(1)
	assert.equal(limiter.snapshot().isWaiting, true)
	second()
	;(await third)()
	let fourthIn = false
	const fourth = limiter.acquire().then((release) => {
		fourthIn = true
		return release
	})
	await new Promise((resolve) => setTimeout(resolve, 5))
	assert.equal(fourthIn, false)
	now = 1_000
	await new Promise((resolve) => setTimeout(resolve, 40))
	assert.equal(fourthIn, true, 'the probe goes out once the wait is over')
	limiter.answered()
	assert.equal(limiter.snapshot().isWaiting, false)
	;(await fourth)()
})
