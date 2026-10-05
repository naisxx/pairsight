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

// A batch is a couple of rounds of the run's share, so its pool stays busy
// while the next batch is claimed, but a pause still lands within seconds.
const ROUNDS_PER_BATCH = 2

export function batchSizeFor(share: number): number {
	return Math.max(1, share) * ROUNDS_PER_BATCH
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
