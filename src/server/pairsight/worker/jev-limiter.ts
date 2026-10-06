// How many Jev calls this server makes at once, and when to stop calling
// for a while (docs/PairSight-Scale-Roadmap.md, item 4). One limiter per
// server process, shared by every running run and by a pair page's re-check.
//
// - Adaptive (AIMD): it starts at RUN_WORKER_CONCURRENCY, climbs a step after
//   each window of clean answers up to RUN_WORKER_CONCURRENCY_MAX, and halves
//   when Jev pushes back, once per burst, down to a floor.
// - Circuit breaker: many busy answers in a row, or Jev naming a time to come
//   back (Retry-After), stop all calls for a while; then a single probe call
//   decides: an answer closes it, another busy one reopens it for longer.
//   An outage of any length is just a longer wait.
//
// The arithmetic is pure (`limiterState` and the `on*` / `gate` functions)
// and takes the time as an argument, so it's tested without a clock; the
// class below hands out call slots with it.

export type LimiterSettings = {
	start: number
	max: number
	floor: number
	// Added after each window of clean answers (a window = the current limit).
	step: number
	// One halving per this long: the rest of a burst is the same pushback.
	cutCooldownMs: number
	// Busy answers in a row that open the breaker.
	tripAfter: number
	// How long the breaker stays open the first time, doubling up to the max.
	openMinMs: number
	openMaxMs: number
}

export const DEFAULT_SETTINGS: Omit<LimiterSettings, 'start' | 'max'> = {
	floor: 2,
	step: 4,
	cutCooldownMs: 5_000,
	tripAfter: 10,
	openMinMs: 5_000,
	openMaxMs: 120_000
}

export type LimiterState = {
	limit: number
	cleanInWindow: number
	busyInARow: number
	lastCutAt: number | null
	// Closed: calls go out. Open: none until `openUntil`. Probing: one call
	// out to see if Jev is back.
	breaker: 'closed' | 'open' | 'probing'
	openUntil: number
	// How long it last stayed open; the next opening is twice that.
	openFor: number
}

export function limiterState(settings: LimiterSettings): LimiterState {
	return {
		limit: Math.max(settings.floor, Math.min(settings.start, settings.max)),
		cleanInWindow: 0,
		busyInARow: 0,
		lastCutAt: null,
		breaker: 'closed',
		openUntil: 0,
		openFor: 0
	}
}

// Jev answered (a score, or a refusal of this pair: it was reachable).
export function onAnswer(state: LimiterState, settings: LimiterSettings): LimiterState {
	const cleanInWindow = state.cleanInWindow + 1
	const grows = cleanInWindow >= state.limit
	return {
		...state,
		breaker: 'closed',
		openFor: state.breaker === 'probing' ? 0 : state.openFor,
		busyInARow: 0,
		cleanInWindow: grows ? 0 : cleanInWindow,
		limit: grows ? Math.min(settings.max, state.limit + settings.step) : state.limit
	}
}

// Jev was busy, slow, down or unreachable. `retryAfterMs`: how long it asked
// us to wait, when it said.
export function onBusy(
	state: LimiterState,
	settings: LimiterSettings,
	now: number,
	retryAfterMs: number | null
): LimiterState {
	const canCut = state.lastCutAt == null || now - state.lastCutAt >= settings.cutCooldownMs
	const limit = canCut ? Math.max(settings.floor, Math.floor(state.limit / 2)) : state.limit
	const busyInARow = state.busyInARow + 1
	const trips =
		state.breaker === 'probing' || busyInARow >= settings.tripAfter || retryAfterMs != null
	const next: LimiterState = {
		...state,
		limit,
		lastCutAt: canCut ? now : state.lastCutAt,
		cleanInWindow: 0,
		busyInARow
	}
	if (!trips) return next
	// Already open (other calls of the same burst): only a longer Retry-After
	// pushes the reopening back.
	if (state.breaker === 'open') {
		return { ...next, openUntil: Math.max(state.openUntil, now + (retryAfterMs ?? 0)) }
	}
	const openFor = Math.min(
		settings.openMaxMs,
		state.openFor === 0 ? settings.openMinMs : state.openFor * 2
	)
	return {
		...next,
		breaker: 'open',
		openFor,
		openUntil: now + Math.max(openFor, retryAfterMs ?? 0)
	}
}

// How many calls may be out at once right now, and if none may start until
// later, when. A breaker whose time is up lets one probe through.
export function gate(
	state: LimiterState,
	now: number
): { state: LimiterState; slots: number; until: number | null } {
	if (state.breaker === 'open') {
		if (now < state.openUntil) return { state, slots: 0, until: state.openUntil }
		return { state: { ...state, breaker: 'probing' }, slots: 1, until: null }
	}
	if (state.breaker === 'probing') return { state, slots: 1, until: null }
	return { state, slots: state.limit, until: null }
}

type Waiter = () => void

// The slots themselves: `run` waits for one, makes the call, and feeds what
// happened back into the state.
export class JevLimiter {
	private state: LimiterState
	private inFlight = 0
	private waiters: Waiter[] = []
	private timer: ReturnType<typeof setTimeout> | null = null
	private readonly settings: LimiterSettings
	private readonly now: () => number

	constructor(settings: LimiterSettings, now: () => number = Date.now) {
		this.settings = settings
		this.now = now
		this.state = limiterState(settings)
	}

	// The current limit and whether calls are held back (for the worker's
	// share of slots per run, and for showing a run as waiting).
	snapshot() {
		const { state } = gate(this.state, this.now())
		return { limit: state.limit, isWaiting: state.breaker !== 'closed', openUntil: state.openUntil }
	}

	answered() {
		this.state = onAnswer(this.state, this.settings)
		this.pump()
	}

	busy(retryAfterMs: number | null) {
		this.state = onBusy(this.state, this.settings, this.now(), retryAfterMs)
		this.pump()
	}

	// Waits for a slot; the returned function gives it back.
	async acquire(): Promise<() => void> {
		await new Promise<void>((resolve) => {
			this.waiters.push(resolve)
			this.pump()
		})
		let isReleased = false
		return () => {
			if (isReleased) return
			isReleased = true
			this.inFlight--
			this.pump()
		}
	}

	private pump() {
		const opened = gate(this.state, this.now())
		this.state = opened.state
		while (this.waiters.length > 0 && this.inFlight < opened.slots) {
			const next = this.waiters.shift()
			this.inFlight++
			next?.()
		}
		if (opened.until != null && this.waiters.length > 0 && this.timer == null) {
			this.timer = setTimeout(
				() => {
					this.timer = null
					this.pump()
				},
				Math.max(0, opened.until - this.now())
			)
		}
	}
}

const LIMITER = Symbol.for('pairsight.jevLimiter')

// This process's limiter: one for every run and re-check it makes.
export function jevLimiter(settings: { start: number; max: number }): JevLimiter {
	// Kept on globalThis, as the run worker's started flag is: dev reloads
	// re-run this module, and must never make a second limiter.
	const holder = globalThis as { [LIMITER]?: JevLimiter }
	holder[LIMITER] ??= new JevLimiter({
		...DEFAULT_SETTINGS,
		start: settings.start,
		max: Math.max(settings.start, settings.max)
	})
	return holder[LIMITER]
}
