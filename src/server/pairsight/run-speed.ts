import 'server-only'
import { env } from '@/lib/env'
import { db } from '@/server/db/client'
import { fallbackRate, MIN_CHECKS_FOR_SPEED, rateFromHistory } from './run-estimate'

// Recent finished runs a speed is taken from (run-estimate.ts).
const RECENT_RUNS = 5
const MS_PER_SECOND = 1_000

// Pairs per second this server checks: from its pool's last few finished live runs,
// each with its stored count of new checks and its checking time (one small
// read of the runs table), else from the speed test.
export async function recentCheckRate(): Promise<number> {
	const recent = await db.run.findMany({
		where: {
			status: 'completed',
			origin: 'live',
			// This server's own runs: another pool on the same database (the
			// e2e suite's stub runs next to real ones) runs at its own speed.
			workerPool: env.RUN_WORKER_POOL,
			newChecks: { gte: MIN_CHECKS_FOR_SPEED },
			completedAt: { not: null }
		},
		orderBy: { createdAt: 'desc' },
		take: RECENT_RUNS,
		select: { newChecks: true, createdAt: true, completedAt: true }
	})
	const history = recent.map((run) => ({
		newChecks: run.newChecks ?? 0,
		seconds: ((run.completedAt?.getTime() ?? 0) - run.createdAt.getTime()) / MS_PER_SECOND
	}))
	return rateFromHistory(history) ?? fallbackRate(env.RUN_WORKER_CONCURRENCY)
}
