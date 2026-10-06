import 'server-only'
import { env } from '@/lib/env'
import { AppError } from '@/lib/errors/app-error'
import { db } from '@/server/db/client'
import { chunks } from './chunks'
import { pairKey } from './pairs'
import { computePlan, type PlanBlocker } from './plan'
import { recountRun } from './runs'
import { ownerScope } from './scope'

// Starting a run freezes the configuration (docs/PairSight-V1-Scope.md, "Runs
// and reuse"): the run stores a snapshot, its pairs, and a link from each pair
// to the assessment that judges it. Succeeded assessments with the same
// records and judgment key are reused; only new pairs go to Jev.

// Starting writes every pair of the run in one transaction, so a failed
// start leaves nothing behind: in batches (one statement per batch), with
// time to match its size. Measured locally: 99.7K pairs started in about
// 25 s (docs/PairSight-Scale-Roadmap.md, item 8); this allows about 80 s.
const INSERT_BATCH = 5_000
const START_TIMEOUT_MIN_MS = 30_000
const START_TIMEOUT_MS_PER_PAIR = 0.5
const START_TIMEOUT_MAX_MS = 180_000

function startTimeoutMs(pairCount: number): number {
	return Math.min(
		START_TIMEOUT_MAX_MS,
		START_TIMEOUT_MIN_MS + Math.ceil(pairCount * START_TIMEOUT_MS_PER_PAIR)
	)
}

const BLOCKER_MESSAGES: Record<PlanBlocker, string> = {
	no_dataset: 'Upload your records first.',
	no_vendors: 'Add at least one vendor’s file first.',
	no_jev_fields: 'Choose at least two values for Jev to see.',
	no_pairs: 'There’s nothing to check yet. Turn on a comparison rule or add a vendor’s file.',
	too_many_pairs:
		'This is more pairs than one run can check. Turn off a rule that picks a lot, or upload fewer records.',
	still_suggesting: 'PairSight is still looking at your records. Try again in a moment.'
}

export async function startRun({
	ownerId,
	evaluationId
}: {
	ownerId: string
	evaluationId: string
}) {
	const plan = await computePlan({ scope: ownerScope(ownerId), evaluationId })
	const [blocker] = plan.blockers
	if (blocker != null || plan.dataset == null || !('comparison' in plan)) {
		throw new AppError(BLOCKER_MESSAGES[blocker ?? 'no_dataset'], { code: blocker ?? 'no_dataset' })
	}
	const { evaluation, dataset, comparison, config, judgmentKey: key, rules, exports } = plan

	const run = await db.$transaction(
		async (tx) => {
			const last = await tx.run.findFirst({
				where: { evaluationId },
				orderBy: { number: 'desc' },
				select: { number: true }
			})
			// Rules sets it; the run keeps it, so its results never shift later.
			const threshold = evaluation.threshold
			const run = await tx.run.create({
				data: {
					evaluationId,
					datasetId: dataset.id,
					number: (last?.number ?? 0) + 1,
					entityType: config.entityType,
					identitySame: config.identity.same,
					identityDifferent: config.identity.different,
					countryCode: config.country,
					jevFields: config.jevFields,
					blockingRules: rules,
					exportIds: exports.map((vendorExport) => vendorExport.id),
					judgmentKey: key,
					jevModel: config.model,
					threshold,
					initialThreshold: threshold,
					pairCount: comparison.length,
					workerPool: env.RUN_WORKER_POOL
				},
				select: { id: true }
			})

			// Scores already given for these records and settings, read once.
			const existing = await tx.assessment.findMany({
				where: { datasetId: dataset.id, judgmentKey: key },
				select: { id: true, recordAId: true, recordBId: true, status: true }
			})
			const idByPair = new Map<string, string>()
			const retried: string[] = []
			let succeeded = 0
			for (const row of existing) {
				idByPair.set(pairKey({ a: row.recordAId, b: row.recordBId }), row.id)
			}
			const statusById = new Map(existing.map((row) => [row.id, row.status]))
			const missing = comparison.filter((pair) => {
				const id = idByPair.get(pairKey(pair))
				if (id == null) return true
				// A failure from an earlier run gets another attempt in this one: only
				// the pairs this run compares, so an older run's failed pairs stay
				// failed there instead of waiting forever as "not checked yet".
				const status = statusById.get(id)
				if (status === 'failed') retried.push(id)
				if (status === 'succeeded') succeeded++
				return false
			})
			for (const chunk of chunks(missing, INSERT_BATCH)) {
				const created = await tx.assessment.createManyAndReturn({
					data: chunk.map((pair) => ({
						datasetId: dataset.id,
						recordAId: pair.a,
						recordBId: pair.b,
						judgmentKey: key
					})),
					select: { id: true, recordAId: true, recordBId: true }
				})
				for (const row of created) {
					idByPair.set(pairKey({ a: row.recordAId, b: row.recordBId }), row.id)
				}
			}
			for (const chunk of chunks(retried, INSERT_BATCH)) {
				await tx.assessment.updateMany({
					where: { id: { in: chunk }, status: 'failed' },
					data: { status: 'pending', attempts: 0, errorCode: null, nextTryAt: null }
				})
			}
			const runPairs = comparison.flatMap((pair) => {
				const assessmentId = idByPair.get(pairKey(pair))
				return assessmentId == null
					? []
					: [
							{
								runId: run.id,
								recordAId: pair.a,
								recordBId: pair.b,
								ruleIds: pair.ruleIds,
								matchedByExportIds: pair.matchedByExportIds,
								assessmentId
							}
						]
			})
			for (const chunk of chunks(runPairs, INSERT_BATCH)) {
				await tx.runPair.createMany({ data: chunk })
			}
			// What it sends to Jev: everything without a score yet. Nothing left
			// (a re-run with only a new threshold reuses every score): the run is
			// complete from the start, not "checking" for a beat.
			const unjudged = runPairs.length - succeeded
			await tx.run.update({
				where: { id: run.id },
				data:
					unjudged === 0
						? { newChecks: 0, status: 'completed', completedAt: new Date() }
						: { newChecks: unjudged }
			})
			await tx.evaluation.update({ where: { id: evaluationId }, data: { updatedAt: new Date() } })
			return run
		},
		{ timeout: startTimeoutMs(comparison.length) }
	)
	// Counted from the start: pairs already checked in earlier runs count.
	await recountRun(run.id)
	return run
}
