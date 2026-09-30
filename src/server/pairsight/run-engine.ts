import 'server-only'
import { db } from '@/server/db/client'
import { isTrackedModel } from '@/server/lib/ai-usage/models'
import { log } from '@/server/lib/logger'
import { mapRecordFields } from './fields'
import type { JudgmentConfig } from './judgment'
import { assess, RunStopped } from './assess'
import { getOwnedRun, getRunProgress, type RunProgress } from './runs'
import { parseIdentityRoles } from './schemas'
import { parseColumnRoles, parseRecordValues } from './json'

// Advances a run by one batch (docs/PairSight-Delivery-Plan.md, "Run
// execution"): the run page calls this in a loop while it's open, so closing
// the page pauses the run and reopening resumes it. Work is claimed in the
// database; a claim older than STALE_CLAIM_MS (a crash or a dev-server
// reload mid-call) is reclaimed.

const BATCH_SIZE = 10
const CONCURRENCY = 4
const STALE_CLAIM_MS = 60_000

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

async function claimBatch(runId: string) {
	const claimable = {
		runPairs: { some: { runId } },
		OR: [
			{ status: 'pending' as const },
			{ status: 'running' as const, claimedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } }
		]
	}
	const candidates = await db.assessment.findMany({
		where: claimable,
		orderBy: { createdAt: 'asc' },
		take: BATCH_SIZE,
		select: { id: true, recordAId: true, recordBId: true }
	})
	if (candidates.length === 0) return []
	await db.assessment.updateMany({
		where: { ...claimable, id: { in: candidates.map((candidate) => candidate.id) } },
		data: { status: 'running', claimedAt: new Date() }
	})
	return candidates
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
	if (!isTrackedModel(run.jevModel)) throw new Error(`Run ${runId} has an unmapped Jev model`)

	const claimed = await claimBatch(runId)
	if (claimed.length > 0) {
		const [dataset, records] = await Promise.all([
			db.sourceDataset.findUniqueOrThrow({
				where: { id: run.datasetId },
				select: { columnRoles: true }
			}),
			db.sourceRecord.findMany({
				where: { id: { in: claimed.flatMap((item) => [item.recordAId, item.recordBId]) } },
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
			identity: { same: run.identitySame, different: run.identityDifferent },
			jevFields: parseIdentityRoles(run.jevFields),
			country: run.countryCode,
			model: run.jevModel
		}

		let stopped = false
		await inPool(claimed, CONCURRENCY, async (assessment) => {
			if (stopped) {
				await db.assessment.update({
					where: { id: assessment.id },
					data: { status: 'pending', claimedAt: null }
				})
				return
			}
			try {
				await assess({
					assessmentId: assessment.id,
					runId,
					config,
					recordA: fieldsById.get(assessment.recordAId) ?? {},
					recordB: fieldsById.get(assessment.recordBId) ?? {}
				})
			} catch (error) {
				if (!(error instanceof RunStopped)) throw error
				stopped = true
				await db.run.update({
					where: { id: runId },
					data: { status: 'stopped', stopReason: error.message }
				})
			}
		})
	}

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
