// The run worker's arithmetic, kept pure so it's tested without a database
// (run-worker.ts does the I/O).

// How many Jev calls each running run gets, out of the worker's total: an
// even split, at least one each, the remainder going to the oldest runs
// (listed first). With more runs than calls, every run still gets one.
export function shareConcurrency(total: number, runCount: number): number[] {
	if (runCount <= 0) return []
	const base = Math.max(1, Math.floor(total / runCount))
	const remainder = Math.max(0, total - base * runCount)
	return Array.from({ length: runCount }, (_, index) => base + (index < remainder ? 1 : 0))
}

// More pairs are started once this share of a run's calls have come back:
// often enough that the calls stay busy, seldom enough that it isn't a
// database read per answer. With nothing in flight, any room at all.
const REFILL_FRACTION = 4

export function shouldRefill({ share, inFlight }: { share: number; inFlight: number }): boolean {
	const room = share - inFlight
	if (room <= 0) return false
	return inFlight === 0 || room >= Math.max(1, Math.ceil(share / REFILL_FRACTION))
}

// Reports an unexpected failure once per run and kind, not once per retry:
// a loop that keeps hitting the same error would otherwise flood the error
// tracker (docs/rules/error-handling.md).
export function createReportOnce() {
	const seen = new Set<string>()
	return (runId: string, kind: string): boolean => {
		const key = `${runId}:${kind}`
		if (seen.has(key)) return false
		seen.add(key)
		return true
	}
}
