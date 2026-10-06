import 'server-only'
import { db } from '@/server/db/client'
import { isTrackedModel } from '@/server/lib/ai-usage/models'
import { log } from '@/server/lib/logger'
import { mapRecordFields } from './fields'
import type { JudgmentConfig } from './judgment'
import { assess, RunStopped } from './assess'
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
// The background run worker (worker/run-worker.ts) calls processRunBatch in a
// loop for every running run, so runs keep going with no page open. Work is
// claimed in the database, one pair at a time just before it's judged, so two
// callers (two server instances, a retried pair) never judge the same pair.
// A claim is renewed before every Jev attempt (assess.ts), so a live claim
// goes untouched for at most one request timeout (20 s) plus the longest
// backoff (3 s). Anything older than this was abandoned — a crash or a
// dev-server reload mid-call — and is claimed again.
const STALE_CLAIM_MS = 60_000

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

async function inPool<T>(items: T[], size: number, worker: (item: T) => Promise<void>) {
	const queue = [...items]
	const next = async (): Promise<void> => {
		const item = queue.shift()
		if (item == null) return
		await worker(item)
		return next()
	}
	await Promise.all(Array.from({ length: Math.min(size, items.length) }, next))
}

function claimableIn(runId: string) {
	return {
		runPairs: { some: { runId } },
		OR: [
			{ status: 'pending' as const },
			{ status: 'running' as const, claimedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } }
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

// Judges assessments with the run's frozen configuration. With `claimFirst`
// each one is claimed just before its call and skipped if another caller got
// it; without, the caller has already claimed them. A configuration problem
// stops the run and leaves the rest untouched.
async function judge({
	run,
	assessments,
	claimFirst,
	concurrency
}: {
	run: JudgedRun
	assessments: Claimable[]
	claimFirst: boolean
	// Jev calls at once.
	concurrency: number
}) {
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

	let stopped = false
	await inPool(assessments, concurrency, async (assessment) => {
		if (stopped) return
		if (claimFirst && !(await claim(run.id, assessment.id))) return
		try {
			await assess({
				assessmentId: assessment.id,
				runId: run.id,
				config,
				recordA: fieldsById.get(assessment.recordAId) ?? {},
				recordB: fieldsById.get(assessment.recordBId) ?? {}
			})
		} catch (error) {
			if (!(error instanceof RunStopped)) throw error
			stopped = true
			await db.run.update({
				where: { id: run.id },
				data: { status: 'stopped', stopReason: error.message }
			})
		}
	})
}

// One batch of a running run: claims up to `batchSize` of its unjudged pairs
// and judges them, `concurrency` at a time. Returns how many it found to
// work on, so the caller knows when the run has nothing left to claim. Not
// scoped to an owner: only the worker calls it; actions check ownership.
export async function processRunBatch({
	runId,
	batchSize,
	concurrency
}: {
	runId: string
	batchSize: number
	concurrency: number
}): Promise<number> {
	const run = await db.run.findUnique({ where: { id: runId } })
	if (run == null || run.status !== 'running') return 0
	const candidates = await db.assessment.findMany({
		where: claimableIn(runId),
		orderBy: { createdAt: 'asc' },
		take: batchSize,
		select: { id: true, recordAId: true, recordBId: true }
	})
	if (candidates.length > 0) {
		await judge({ run, assessments: candidates, claimFirst: true, concurrency })
	}
	return candidates.length
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
	const [summary, counts] = await Promise.all([buildRunSummary(run), recountRun(runId)])
	const { count } = await db.run.updateMany({
		where: { id: runId, status: 'running' },
		data: { status: 'completed', ...summaryColumns(summary) }
	})
	if (count === 1) {
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
// the claim. A configuration problem stops the run, as in the loop, so the
// Run page offers to resume it.
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
	const { count } = await db.assessment.updateMany({
		where: { id: pair.assessment.id, status: 'failed' },
		data: { status: 'running', attempts: 0, errorCode: null, claimedAt: new Date() }
	})
	if (count === 1) {
		await judge({ run, assessments: [pair.assessment], claimFirst: false, concurrency: 1 })
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
