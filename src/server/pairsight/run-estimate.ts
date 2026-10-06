// How long a run will take, for the Plan screen (docs/PairSight-Scale-Roadmap.md,
// item 4). Worked out from how fast this server's recent runs checked pairs,
// or, before there are any, from the speed test; then padded by 30%, because
// finishing early is fine and finishing late isn't. Pure: the history is
// read in run-speed.ts.

// Padding on top of the plain estimate.
export const ESTIMATE_BUFFER = 1.3
// A run needs this many new checks for its speed to count: a handful of
// pairs is mostly start-up time, not checking speed.
export const MIN_CHECKS_FOR_SPEED = 50
// Before any run has finished here: seconds per Jev call, measured live with
// `pnpm jev:speed` on 2026-10-06 (120 calls at once checked 254.7 pairs/s,
// so 120 / 254.7 ≈ 0.47 s each). Rounded up to stay on the safe side.
export const SECONDS_PER_CALL = 0.5

const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60
// Up to this many minutes it's said in minutes ("about 75 minutes"), then in
// hours ("about 2 hours").
const MINUTES_BEFORE_HOURS = 90

export type PastRun = { newChecks: number; seconds: number }

// Pairs per second over recent runs taken together: all their checks over
// all their checking time, so a big run counts for more than a small one
// (whose time is mostly getting started and finishing, not checking). Null
// when none checked enough to go by.
export function rateFromHistory(runs: PastRun[]): number | null {
	const counted = runs.filter((run) => run.newChecks >= MIN_CHECKS_FOR_SPEED && run.seconds > 0)
	if (counted.length === 0) return null
	const checks = counted.reduce((sum, run) => sum + run.newChecks, 0)
	const seconds = counted.reduce((sum, run) => sum + run.seconds, 0)
	return checks / seconds
}

export function fallbackRate(concurrency: number): number {
	return Math.max(1, concurrency) / SECONDS_PER_CALL
}

export type RunDuration =
	| { unit: 'none' }
	| { unit: 'underMinute' }
	| { unit: 'minutes'; value: number }
	| { unit: 'hours'; value: number }

// New checks at `pairsPerSecond`, padded and rounded up to a friendly unit.
export function estimateRunDuration({
	newChecks,
	pairsPerSecond
}: {
	newChecks: number
	pairsPerSecond: number
}): RunDuration {
	if (newChecks <= 0) return { unit: 'none' }
	const seconds = (newChecks / Math.max(pairsPerSecond, Number.EPSILON)) * ESTIMATE_BUFFER
	const minutes = Math.ceil(seconds / SECONDS_PER_MINUTE)
	if (seconds < SECONDS_PER_MINUTE) return { unit: 'underMinute' }
	if (minutes <= MINUTES_BEFORE_HOURS) return { unit: 'minutes', value: minutes }
	return { unit: 'hours', value: Math.ceil(minutes / MINUTES_PER_HOUR) }
}
