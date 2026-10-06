import 'server-only'
import { env } from '@/lib/env'
import { db } from '@/server/db/client'
import { isTrackedModel } from '@/server/lib/ai-usage/models'
import { log } from '@/server/lib/logger'
import { mapRecordFields } from './fields'
import type { JudgmentConfig } from './judgment'
import { assess, limiter, RunStopped, type AssessOutcome } from './assess'
import { getOwnedRun, recountRun, runNotFound } from './runs'
import {
	buildRunSummary,
	clearRunSummaries,
	refreshRunSummaries,
	SUMMARY_RUN_SELECT,
	summaryColumns
} from './run-summary'
import { parseIdentityRoles } from './schemas'
import { parseColumnRoles, parseRecordValues } from './json'

// Judges a run's pairs (docs/PairSight-Delivery-Plan.md, "Run execution").
// The background run worker (worker/run-worker.ts) keeps each running run's
// calls topped up with startRunCalls, so runs keep going with no page open
// and one slow call never holds up the rest. Work is
// claimed in the database, one pair at a time just before it's judged, so two
// callers (two server instances, a retried pair) never judge the same pair.
// A claim is renewed before every Jev call (assess.ts) and nothing sleeps
// while holding one, so a live claim goes untouched for at most one request
// timeout (TYPESAFE_TIMEOUT_MS). Anything older than this, with room to
// spare, was abandoned — a crash, a dev-server reload mid-call, or our own
// database failing to save an answer — and is claimed again.
const CLAIM_MARGIN_MS = 20_000
const STALE_CLAIM_MS = 2 * env.TYPESAFE_TIMEOUT_MS + CLAIM_MARGIN_MS

// What judging needs from a run: its frozen configuration.
type JudgedRun = {
	id: string
	datasetId: string
	entityType: JudgmentConfig['entityType']
	identitySame: string
	identityDifferent: string
	jevFields: string[]
	countryCode: string
	jevModel: string
}
type Claimable = { id: string; recordAId: string; recordBId: string }

// Waiting pairs, once their next try is due, and abandoned claims.
function claimableIn(runId: string) {
	const now = Date.now()
	return {
		runPairs: { some: { runId } },
		OR: [
			{ status: 'pending' as const, nextTryAt: null },
			{ status: 'pending' as const, nextTryAt: { lte: new Date(now) } },
			{ status: 'running' as const, claimedAt: { lt: new Date(now - STALE_CLAIM_MS) } }
		]
	}
}

// Atomic: the update only matches while the row is still claimable, so of
// two callers racing for one pair exactly one gets a count of 1.
async function claim(runId: string, assessmentId: string) {
	const { count } = await db.assessment.updateMany({
		where: { id: assessmentId, ...claimableIn(runId) },
		data: { status: 'running', claimedAt: new Date() }
	})
	return count === 1
}

// Loads what judging a run's pairs needs: its frozen configuration and the
// two records of each pair, mapped to Jev's fields.
async function prepare(run: JudgedRun, assessments: Claimable[]) {
	if (!isTrackedModel(run.jevModel)) throw new Error(`Run ${run.id} has an unmapped Jev model`)
	const [dataset, records] = await Promise.all([
		db.sourceDataset.findUniqueOrThrow({
			where: { id: run.datasetId },
			select: { columnRoles: true }
		}),
		db.sourceRecord.findMany({
			where: { id: { in: assessments.flatMap((item) => [item.recordAId, item.recordBId]) } },
			select: { id: true, values: true }
		})
	])
	const columnRoles = parseColumnRoles(dataset.columnRoles)
	const fieldsById = new Map(
		records.map((record) => [
			record.id,
			mapRecordFields({ values: parseRecordValues(record.values), columnRoles })
		])
	)
	const config: JudgmentConfig = {
		entityType: run.entityType,
		identity: { same: run.identitySame, different: run.identityDifferent },
		jevFields: parseIdentityRoles(run.jevFields),
		country: run.countryCode,
		model: run.jevModel
	}
	return { config, fieldsById }
}

// Whether a run was stopped (its key) while its pairs were being judged:
// shared by them, so the rest don't call Jev for nothing.
type StopFlag = { stopped: boolean }

// Judges one pair: takes one of the process's Jev call slots
// (worker/jev-limiter.ts) first, then, with `claimFirst`, claims it (skipped
// if another caller got it); without, the caller has already claimed it (a
// re-check, judged `once`). A configuration problem stops a running run.
// Null when it wasn't judged here.
async function judgeOne({
	run,
	assessment,
	prepared,
	claimFirst,
	stop
}: {
	run: JudgedRun
	assessment: Claimable
	prepared: Awaited<ReturnType<typeof prepare>>
	claimFirst: boolean
	stop: StopFlag
}): Promise<AssessOutcome | null> {
	if (stop.stopped) return null
	// A slot before the claim: while Jev is down, nothing sits claimed.
	const release = await limiter().acquire()
	try {
		if (stop.stopped) return null
		if (claimFirst && !(await claim(run.id, assessment.id))) return null
		return await assess({
			assessmentId: assessment.id,
			runId: run.id,
			config: prepared.config,
			recordA: prepared.fieldsById.get(assessment.recordAId) ?? {},
			recordB: prepared.fieldsById.get(assessment.recordBId) ?? {},
			once: !claimFirst
		})
	} catch (error) {
		if (!(error instanceof RunStopped)) throw error
		stop.stopped = true
		// Only a running run: a finished one stays finished (a re-check).
		await db.run.updateMany({
			where: { id: run.id, status: 'running' },
			data: { status: 'stopped', stopReason: error.message, waitingSince: null }
		})
		return null
	} finally {
		release()
	}
}

// A running run's pairs being judged by this server right now, kept by the
// run worker: what it hasn't heard back about yet, and how the rest went.
export type RunFlight = StopFlag & {
	inFlight: Set<string>
	settled: (assessmentId: string, outcome: AssessOutcome | null) => void
	failed: (assessmentId: string, error: unknown) => void
}

// Starts up to `room` more of a running run's pairs that are due, without
// waiting for their answers: each reports back to `flight` when it's done, so
// one slow or stuck call holds only its own slot while the others go on
// (docs/PairSight-Scale-Roadmap.md, item 4). Returns how many it started, so
// the caller knows when the run has nothing left to claim. Not scoped to an
// owner: only the worker calls it; actions check ownership.
export async function startRunCalls({
	runId,
	room,
	flight
}: {
	runId: string
	room: number
	flight: RunFlight
}): Promise<number> {
	if (room <= 0) return 0
	const run = await db.run.findUnique({ where: { id: runId } })
	if (run == null || run.status !== 'running') return 0
	const candidates = await db.assessment.findMany({
		where: { ...claimableIn(runId), id: { notIn: [...flight.inFlight] } },
		orderBy: { createdAt: 'asc' },
		take: room,
		select: { id: true, recordAId: true, recordBId: true }
	})
	if (candidates.length === 0) return 0
	const prepared = await prepare(run, candidates)
	flight.stopped = false
	for (const assessment of candidates) {
		flight.inFlight.add(assessment.id)
		judgeOne({ run, assessment, prepared, claimFirst: true, stop: flight }).then(
			(outcome) => flight.settled(assessment.id, outcome),
			(error: unknown) => flight.failed(assessment.id, error)
		)
	}
	return candidates.length
}

// A run is waiting while Jev is busy or down and none of its pairs are being
// answered; its card says so (runs.ts getRunProgress). Set once, so the
// card's "waiting 2m" counts from when it began; cleared by an answer.
export async function markWaiting(runIds: string[], isWaiting: boolean) {
	if (runIds.length === 0) return
	await db.run.updateMany({
		where: {
			id: { in: runIds },
			status: 'running',
			waitingSince: isWaiting ? null : { not: null }
		},
		data: { waitingSince: isWaiting ? new Date() : null }
	})
}

// A running run with nothing pending or in flight is complete (failed pairs
// don't hold it open; they can be tried again from its card). Returns whether
// the run is no longer running, for whatever reason.
export async function finishIfDone(runId: string): Promise<boolean> {
	const current = await db.run.findUniqueOrThrow({
		where: { id: runId },
		select: { status: true }
	})
	if (current.status !== 'running') return true
	// Asked of the pairs themselves, not the stored counts: only the pairs
	// still waiting or being checked are read (an index on their status).
	const outstanding = await db.assessment.count({
		where: { runPairs: { some: { runId } }, status: { in: ['pending', 'running'] } }
	})
	if (outstanding > 0) return false
	// Checking is done now: that's when it finished (its elapsed time is the
	// checking, not the summary). Its Overview is worked out before it's
	// marked complete, so a complete run always has one to show; until then
	// the Runs centre says the results are being worked out.
	await db.run.updateMany({
		where: { id: runId, status: 'running', completedAt: null },
		data: { completedAt: new Date() }
	})
	const run = await db.run.findUniqueOrThrow({
		where: { id: runId },
		select: { ...SUMMARY_RUN_SELECT, judgmentKey: true }
	})
	const summary = await buildRunSummary(run)
	const { count } = await db.run.updateMany({
		where: { id: runId, status: 'running' },
		data: { status: 'completed', waitingSince: null, ...summaryColumns(summary) }
	})
	if (count === 1) {
		// Counted exactly once it's complete: answers still being counted
		// (runs.ts countAnswer) only add to running runs, so none land after.
		const counts = await recountRun(runId)
		log.info('pairsight run completed', {
			runId,
			succeeded: counts.checkedCount - counts.failedCount,
			failed: counts.failedCount
		})
		// Pairs it judged may be shared with other finished runs.
		await clearRunSummaries({
			datasetId: run.datasetId,
			judgmentKey: run.judgmentKey,
			exceptRunId: runId
		})
		await refreshRunSummaries({ datasetId: run.datasetId, judgmentKey: run.judgmentKey })
	}
	return true
}

// One failed pair, judged again now from its pair page. Only a failed
// judgment is taken (pending ones belong to the run loop), and taking it is
// the claim. If Jev is busy (or calls are being held back) the pair stays
// failed, to be tried again in a moment. A configuration problem stops a
// running run, as in the loop, so the Run page offers to resume it.
export async function retryPair({
	ownerId,
	runId,
	pairId
}: {
	ownerId: string
	runId: string
	pairId: string
}) {
	const run = await getOwnedRun({ ownerId, runId })
	const pair = await db.runPair.findFirst({
		where: { id: pairId, runId },
		select: { assessment: { select: { id: true, recordAId: true, recordBId: true } } }
	})
	if (pair == null) throw runNotFound()
	if (limiter().snapshot().isWaiting) return { status: 'failed' as const, run }
	const { count } = await db.assessment.updateMany({
		where: { id: pair.assessment.id, status: 'failed' },
		data: { status: 'running', attempts: 0, errorCode: null, claimedAt: new Date() }
	})
	if (count === 1) {
		const prepared = await prepare(run, [pair.assessment])
		await judgeOne({
			run,
			assessment: pair.assessment,
			prepared,
			claimFirst: false,
			stop: { stopped: false }
		})
		// Every finished run holding this pair now counts it differently; the
		// action rebuilds them once it has answered.
		await clearRunSummaries({ datasetId: run.datasetId, judgmentKey: run.judgmentKey })
		await recountRun(runId)
	}
	const { status } = await db.assessment.findUniqueOrThrow({
		where: { id: pair.assessment.id },
		select: { status: true }
	})
	return { status, run }
}
