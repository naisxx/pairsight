import 'server-only'
import { AppError } from '@/lib/errors/app-error'
import { db } from '@/server/db/client'
import { DEFAULT_THRESHOLD } from './decisions'
import { pairKey } from './pairs'
import { computePlan, type PlanBlocker } from './plan'

// Starting a run freezes the configuration (docs/PairSight-V1-Scope.md, "Runs
// and reuse"): the run stores a snapshot, its pairs, and a link from each pair
// to the assessment that judges it. Succeeded assessments with the same
// records and judgment key are reused; only new pairs go to Jev.

const RUN_TRANSACTION_TIMEOUT_MS = 30_000

const BLOCKER_MESSAGES: Record<PlanBlocker, string> = {
	no_dataset: 'Upload the source records first.',
	no_vendors: 'Add at least one vendor’s results first.',
	no_jev_fields: 'Choose at least two identity fields for Jev to compare.',
	no_pairs: 'There are no pairs to evaluate. Turn on a blocking rule or add vendor results.',
	too_many_pairs:
		'This plan has more pairs than one run allows. Turn off a broad rule or reduce the input.'
}

export async function startRun({
	ownerId,
	evaluationId
}: {
	ownerId: string
	evaluationId: string
}) {
	const plan = await computePlan({ ownerId, evaluationId })
	const [blocker] = plan.blockers
	if (blocker != null || plan.dataset == null || !('comparison' in plan)) {
		throw new AppError(BLOCKER_MESSAGES[blocker ?? 'no_dataset'], { code: blocker ?? 'no_dataset' })
	}
	const { evaluation, dataset, comparison, config, judgmentKey: key, rules, exports } = plan

	return db.$transaction(
		async (tx) => {
			const last = await tx.run.findFirst({
				where: { evaluationId },
				orderBy: { number: 'desc' },
				select: { number: true, threshold: true }
			})
			const threshold = last?.threshold ?? evaluation.threshold ?? DEFAULT_THRESHOLD
			const run = await tx.run.create({
				data: {
					evaluationId,
					datasetId: dataset.id,
					number: (last?.number ?? 0) + 1,
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
					pairCount: comparison.length
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
			// A failure from an earlier run gets another attempt in this one.
			await tx.assessment.updateMany({
				where: { datasetId: dataset.id, judgmentKey: key, status: 'failed' },
				data: { status: 'pending', attempts: 0, errorCode: null }
			})
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
			await tx.evaluation.update({ where: { id: evaluationId }, data: { updatedAt: new Date() } })
			return run
		},
		{ timeout: RUN_TRANSACTION_TIMEOUT_MS }
	)
}
