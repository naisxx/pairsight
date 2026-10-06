import 'server-only'
import { env } from '@/lib/env'
import { AppError } from '@/lib/errors/app-error'
import { db } from '@/server/db/client'
import { pairKey } from './pairs'
import { computePlan, type PlanBlocker } from './plan'
import { recountRun } from './runs'
import { ownerScope } from './scope'

// Starting a run freezes the configuration (docs/PairSight-V1-Scope.md, "Runs
// and reuse"): the run stores a snapshot, its pairs, and a link from each pair
// to the assessment that judges it. Succeeded assessments with the same
// records and judgment key are reused; only new pairs go to Jev.

const RUN_TRANSACTION_TIMEOUT_MS = 30_000

const BLOCKER_MESSAGES: Record<PlanBlocker, string> = {
	no_dataset: 'Upload your records first.',
	no_vendors: 'Add at least one vendor’s file first.',
	no_jev_fields: 'Choose at least two values for Jev to see.',
	no_pairs: 'There’s nothing to check yet. Turn on a comparison rule or add a vendor’s file.',
	too_many_pairs:
		'This is more pairs than one run can check. Turn off a rule that picks a lot, or upload fewer records.'
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

			const existing = await tx.assessment.findMany({
				where: { datasetId: dataset.id, judgmentKey: key },
				select: { id: true, recordAId: true, recordBId: true, status: true }
			})
			const byPair = new Map(
				existing.map((row) => [pairKey({ a: row.recordAId, b: row.recordBId }), row])
			)
			const missing = comparison.filter((pair) => !byPair.has(pairKey(pair)))
			await tx.assessment.createMany({
				data: missing.map((pair) => ({
					datasetId: dataset.id,
					recordAId: pair.a,
					recordBId: pair.b,
					judgmentKey: key
				}))
			})
			// A failure from an earlier run gets another attempt in this one: only
			// the pairs this run compares, so an older run's failed pairs stay
			// failed there instead of waiting forever as "not checked yet".
			const retried = comparison.flatMap((pair) => {
				const row = byPair.get(pairKey(pair))
				return row?.status === 'failed' ? [row.id] : []
			})
			if (retried.length > 0) {
				await tx.assessment.updateMany({
					where: { id: { in: retried }, status: 'failed' },
					data: { status: 'pending', attempts: 0, errorCode: null }
				})
			}
			const all = await tx.assessment.findMany({
				where: { datasetId: dataset.id, judgmentKey: key },
				select: { id: true, recordAId: true, recordBId: true }
			})
			const idByPair = new Map(
				all.map((row) => [pairKey({ a: row.recordAId, b: row.recordBId }), row.id])
			)
			await tx.runPair.createMany({
				data: comparison.flatMap((pair) => {
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
			})
			// Nothing left to judge (a re-run with only a new threshold reuses every
			// score): the run is complete from the start, not "assessing" for a beat.
			const unjudged = await tx.assessment.count({
				where: { runPairs: { some: { runId: run.id } }, status: { not: 'succeeded' } }
			})
			if (unjudged === 0) {
				await tx.run.update({
					where: { id: run.id },
					data: { status: 'completed', completedAt: new Date() }
				})
			}
			await tx.evaluation.update({ where: { id: evaluationId }, data: { updatedAt: new Date() } })
			return run
		},
		{ timeout: RUN_TRANSACTION_TIMEOUT_MS }
	)
	// Counted from the start: pairs already checked in earlier runs count.
	await recountRun(run.id)
	return run
}
