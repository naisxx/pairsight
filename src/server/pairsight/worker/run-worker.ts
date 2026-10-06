import 'server-only'
import { env } from '@/lib/env'
import { captureError } from '@/lib/observability/capture-error'
import { db } from '@/server/db/client'
import { log as rootLog, withLogContext } from '@/server/lib/logger'
import { limiter } from '../assess'
import { finishIfDone, markWaiting, startRunCalls, type RunFlight } from '../run-engine'
import { claimDatasetToScore, scoreDataset } from '../splink/score-dataset'
import { sweepUploads } from '../uploads'
import { createReportOnce, shareConcurrency, shouldRefill } from './schedule'

// The background run worker (docs/PairSight-Scale-Roadmap.md, items 1 and 4): runs
// keep going with no page open. It lives in the web server, started once at
// boot from instrumentation.ts, and needs no queue: a run with status
// `running` is the work, and each pair is claimed in the database just before
// it's judged (run-engine.ts), so several loops or servers never judge the
// same pair. How many Jev calls go out at once is the shared limiter's
// (jev-limiter.ts): it climbs while Jev keeps up and backs off, or stops for
// a while, when Jev pushes back; runs then wait, never fail. The Runs centre
// only watches progress.

// How often to look for runs to work on, and to re-check a run whose last
// pairs are being judged elsewhere.
const POLL_MS = 1_000
// How often the worker clears old uploads and half-written datasets.
const SWEEP_EVERY_MS = 60 * 60 * 1000
// After an unexpected failure, wait before trying the run again.
const ERROR_BACKOFF_MS = 3_000

const STARTED = Symbol.for('pairsight.runWorker')

const log = rootLog.child({ source: 'run-worker' })
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function startRunWorker() {
	if (env.RUN_WORKER_CONCURRENCY === 0) {
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

	const slots = limiter()
	// This run's share of the Jev calls Jev can take now, by its place among
	// the running runs.
	const shareOf = (runId: string) => {
		const shares = shareConcurrency(slots.snapshot().limit, Math.max(1, order.length))
		return shares[Math.max(0, order.indexOf(runId))] ?? 1
	}

	// One run, kept busy: its calls are topped up as answers come back, never
	// a batch at a time, so a slow or stuck call holds only its own slot.
	const work = (runId: string) =>
		withLogContext({ runId }, async () => {
			const tally = { answered: 0, waiting: 0 }
			let wake: (() => void) | null = null
			const settledOne = () => {
				wake?.()
				wake = null
			}
			const flight: RunFlight = {
				inFlight: new Set(),
				stopped: false,
				settled: (assessmentId, outcome) => {
					flight.inFlight.delete(assessmentId)
					if (outcome === 'answered') tally.answered++
					if (outcome === 'waiting') tally.waiting++
					settledOne()
				},
				failed: (assessmentId, error) => {
					flight.inFlight.delete(assessmentId)
					const kind = error instanceof Error ? error.name : 'unknown'
					log.error('run worker call failed', { kind })
					if (reportOnce(runId, kind)) captureError(error, { runId, source: 'run-worker' })
					settledOne()
				}
			}
			// The next answer back, or a moment, whichever comes first: pairs
			// waiting for their next try become due with no answer to say so.
			const nextAnswerOrPoll = () =>
				new Promise<void>((resolve) => {
					const timer = setTimeout(resolve, POLL_MS)
					wake = () => {
						clearTimeout(timer)
						resolve()
					}
				})

			// After a top-up found fewer pairs than it had room for, the run has
			// nothing more due: look again after a moment, not after every answer.
			let drainedUntil = 0
			while (!stopping) {
				try {
					const share = shareOf(runId)
					const inFlight = flight.inFlight.size
					const room = share - inFlight
					const tops =
						(inFlight === 0 || Date.now() >= drainedUntil) && shouldRefill({ share, inFlight })
					const started = tops ? await startRunCalls({ runId, room, flight }) : 0
					if (tops && started < room) drainedUntil = Date.now() + POLL_MS
					if (tally.answered > 0) await markWaiting([runId], false)
					else if (tally.waiting > 0) await markWaiting([runId], true)
					tally.answered = 0
					tally.waiting = 0
					if (started > 0) continue
					if (flight.inFlight.size > 0) {
						await nextAnswerOrPoll()
						continue
					}
					// Nothing left to claim here and nothing in flight: done, or its
					// last pairs are waiting for a next try, or in flight on another
					// server, and need a moment.
					if (await finishIfDone(runId)) return
					await sleep(POLL_MS)
				} catch (error) {
					const kind = error instanceof Error ? error.name : 'unknown'
					log.error('run worker step failed', { kind })
					if (reportOnce(runId, kind)) captureError(error, { runId, source: 'run-worker' })
					await sleep(ERROR_BACKOFF_MS)
				}
			}
		})

	// Uploads nobody saved and half-written datasets, cleared now and then.
	let lastSweep = 0
	const sweep = async () => {
		if (Date.now() - lastSweep < SWEEP_EVERY_MS) return
		lastSweep = Date.now()
		const swept = await sweepUploads()
		if (swept.uploads + swept.datasets > 0) log.info('old uploads cleared', swept)
	}

	// Splink scoring (splink/score-dataset.ts): one dataset at a time on this
	// server, beside the runs, since it's heavy on CPU and memory.
	let scoring: Promise<void> | null = null
	const scoreNext = async () => {
		if (scoring != null) return
		const datasetId = await claimDatasetToScore()
		if (datasetId == null) return
		scoring = withLogContext({ datasetId }, () => scoreDataset(datasetId)).finally(() => {
			scoring = null
		})
	}

	const loop = async () => {
		log.info('run worker started', {
			concurrency: env.RUN_WORKER_CONCURRENCY,
			concurrencyMax: env.RUN_WORKER_CONCURRENCY_MAX,
			pool: env.RUN_WORKER_POOL
		})
		while (!stopping) {
			await sweep().catch((error: unknown) => {
				if (reportOnce('*', 'sweep')) captureError(error, { source: 'run-worker' })
			})
			await scoreNext().catch((error: unknown) => {
				if (reportOnce('*', 'score')) captureError(error, { source: 'run-worker' })
			})
			try {
				const running = await db.run.findMany({
					where: { status: 'running', origin: 'live', workerPool: env.RUN_WORKER_POOL },
					orderBy: { createdAt: 'asc' },
					select: { id: true }
				})
				order = running.map((run) => run.id)
				// Calls held back (Jev down or asked us to wait): every run waits.
				if (slots.snapshot().isWaiting) await markWaiting(order, true)
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
