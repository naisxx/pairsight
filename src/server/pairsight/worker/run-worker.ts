import 'server-only'
import { env } from '@/lib/env'
import { captureError } from '@/lib/observability/capture-error'
import { db } from '@/server/db/client'
import { log as rootLog, withLogContext } from '@/server/lib/logger'
import { finishIfDone, processRunBatch } from '../run-engine'
import { batchSizeFor, createReportOnce, shareConcurrency } from './schedule'

// The background run worker (docs/PairSight-Scale-Roadmap.md, item 1): runs
// keep going with no page open. It lives in the web server, started once at
// boot from instrumentation.ts, and needs no queue: a run with status
// `running` is the work, and each pair is claimed in the database just before
// it's judged (run-engine.ts), so several loops or servers never judge the
// same pair. The Runs centre only watches progress.

// How often to look for runs to work on, and to re-check a run whose last
// pairs are being judged elsewhere.
const POLL_MS = 1_000
// After an unexpected failure, wait before trying the run again.
const ERROR_BACKOFF_MS = 3_000

const STARTED = Symbol.for('pairsight.runWorker')

const log = rootLog.child({ source: 'run-worker' })
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function startRunWorker() {
	const total = env.RUN_WORKER_CONCURRENCY
	if (total === 0) {
		log.info('run worker off (RUN_WORKER_CONCURRENCY=0)')
		return
	}
	// Once per server: dev reloads re-run this module, never a second loop.
	const state = globalThis as { [STARTED]?: boolean }
	if (state[STARTED] === true) return
	state[STARTED] = true

	const active = new Map<string, Promise<void>>()
	const reportOnce = createReportOnce()
	let order: string[] = []
	let stopping = false
	process.once('SIGTERM', () => {
		stopping = true
	})

	// This run's share of the Jev calls, by its place among the running runs.
	const shareOf = (runId: string) => {
		const shares = shareConcurrency(total, Math.max(1, order.length))
		return shares[Math.max(0, order.indexOf(runId))] ?? 1
	}

	const work = (runId: string) =>
		withLogContext({ runId }, async () => {
			while (!stopping) {
				try {
					const share = shareOf(runId)
					const found = await processRunBatch({
						runId,
						batchSize: batchSizeFor(share),
						concurrency: share
					})
					if (found > 0) continue
					// Nothing left to claim: done, or its last pairs are in flight
					// (here or on another server) and need a moment.
					if (await finishIfDone(runId)) return
					await sleep(POLL_MS)
				} catch (error) {
					const kind = error instanceof Error ? error.name : 'unknown'
					log.error('run worker batch failed', { kind })
					if (reportOnce(runId, kind)) captureError(error, { runId, source: 'run-worker' })
					await sleep(ERROR_BACKOFF_MS)
				}
			}
		})

	const loop = async () => {
		log.info('run worker started', { concurrency: total, pool: env.RUN_WORKER_POOL })
		while (!stopping) {
			try {
				const running = await db.run.findMany({
					where: { status: 'running', origin: 'live', workerPool: env.RUN_WORKER_POOL },
					orderBy: { createdAt: 'asc' },
					select: { id: true }
				})
				order = running.map((run) => run.id)
				for (const runId of order) {
					if (active.has(runId)) continue
					active.set(
						runId,
						work(runId).finally(() => active.delete(runId))
					)
				}
			} catch (error) {
				log.error('run worker could not look for runs')
				if (reportOnce('*', 'poll')) captureError(error, { source: 'run-worker' })
			}
			await sleep(POLL_MS)
		}
		log.info('run worker stopping')
	}

	void loop()
}
