import 'server-only'
import { db } from '@/server/db/client'
import { isTrackedModel } from '@/server/lib/ai-usage/models'
import { log } from '@/server/lib/logger'
import { mapRecordFields } from './fields'
import type { JudgmentConfig } from './judgment'
import { assess, RunStopped } from './assess'
import { getOwnedRun, getRunProgress, runNotFound, type RunProgress } from './runs'
import { parseIdentityRoles } from './schemas'
import { parseColumnRoles, parseRecordValues } from './json'

// Advances a run by one batch (docs/PairSight-Delivery-Plan.md, "Run
// execution"): the run page calls this in a loop while it's open, so closing
// the page pauses the run and reopening resumes it. Work is claimed in the
// database, one pair at a time just before it's judged, so two callers (a
// second tab, a retried request) never judge the same pair.

const BATCH_SIZE = 10
const CONCURRENCY = 4
// A claim is renewed before every Jev attempt (assess.ts), so a live claim
// goes untouched for at most one request timeout (20 s) plus the longest
// backoff (3 s). Anything older than this was abandoned — a crash or a
// dev-server reload mid-call — and is claimed again.
const STALE_CLAIM_MS = 60_000

type OwnedRun = Awaited<ReturnType<typeof getOwnedRun>>
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
	claimFirst
}: {
	run: OwnedRun
	assessments: Claimable[]
	claimFirst: boolean
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
	await inPool(assessments, CONCURRENCY, async (assessment) => {
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

export async function advanceRun({
	ownerId,
	runId
}: {
	ownerId: string
	runId: string
}): Promise<RunProgress> {
	const run = await getOwnedRun({ ownerId, runId })
	if (run.status !== 'running') return getRunProgress(runId)

	const candidates = await db.assessment.findMany({
		where: claimableIn(runId),
		orderBy: { createdAt: 'asc' },
		take: BATCH_SIZE,
		select: { id: true, recordAId: true, recordBId: true }
	})
	if (candidates.length > 0) await judge({ run, assessments: candidates, claimFirst: true })

	const progress = await getRunProgress(runId)
	if (progress.status === 'running' && progress.pending === 0 && progress.running === 0) {
		await db.run.update({
			where: { id: runId },
			data: { status: 'completed', completedAt: new Date() }
		})
		log.info('pairsight run completed', {
			runId,
			succeeded: progress.succeeded,
			failed: progress.failed
		})
		return { ...progress, status: 'completed' }
	}
	return progress
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
	if (count === 1) await judge({ run, assessments: [pair.assessment], claimFirst: false })
	const { status } = await db.assessment.findUniqueOrThrow({
		where: { id: pair.assessment.id },
		select: { status: true }
	})
	return status
}
