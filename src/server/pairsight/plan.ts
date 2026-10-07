import 'server-only'
import { entityTypeOf } from '@/lib/pairsight/entity-types'
import { db } from '@/server/db/client'
import { summarizePlan, type PlanBlocker } from './plan-summary'
import { mappedIdentityRoles } from './fields'
import { JEV_MODEL, judgmentKey, type JudgmentConfig } from './judgment'
import { buildComparisonSet, pairKey, type ComparisonPair } from './pairs'
import { parseIdentityRoles } from './schemas'
import { getCurrentDataset } from './datasets'
import { getVisibleEvaluation } from './evaluations'
import type { EvaluationScope } from './scope'
import { parseColumnRoles } from './json'
import { splinkPicks } from './splink/picks'

// The comparison plan: what a run *would* evaluate right now. Shared by the
// Plan screen and by startRun, so what the user reviews is exactly what runs.
// The pairs are the ones PairSight suggested, plus every pair a vendor matched.

export type { PlanBlocker, PlanContributor, PlanCounts } from './plan-summary'

export async function computePlan({
	scope,
	evaluationId
}: {
	scope: EvaluationScope
	evaluationId: string
}) {
	const evaluation = await getVisibleEvaluation({ scope, id: evaluationId })
	const dataset = await getCurrentDataset(evaluationId)
	if (dataset == null) {
		const blockers: PlanBlocker[] = ['no_dataset']
		return { evaluation, dataset, blockers } as const
	}

	const [exports, splink] = await Promise.all([
		db.vendorExport.findMany({
			where: { evaluationId, datasetId: dataset.id },
			orderBy: { createdAt: 'asc' },
			select: {
				id: true,
				name: true,
				pairCount: true,
				matches: { select: { recordAId: true, recordBId: true } }
			}
		}),
		splinkPicks(dataset.id)
	])

	const mappedRoles = mappedIdentityRoles(parseColumnRoles(dataset.columnRoles))
	const jevFields = parseIdentityRoles(evaluation.jevFields).filter((role) => mappedRoles.has(role))

	const vendorPairs = exports.map((vendorExport) => ({
		exportId: vendorExport.id,
		pairs: vendorExport.matches.map((match) => ({ a: match.recordAId, b: match.recordBId }))
	}))
	const comparison: ComparisonPair[] = buildComparisonSet({ suggested: splink.pairs, vendorPairs })

	const config: JudgmentConfig = {
		entityType: entityTypeOf(evaluation.entityType),
		identity: { same: evaluation.identitySame, different: evaluation.identityDifferent },
		jevFields,
		country: evaluation.countryCode,
		model: JEV_MODEL
	}
	const key = judgmentKey(config)
	const reusableAssessments = await db.assessment.findMany({
		where: { datasetId: dataset.id, judgmentKey: key, status: 'succeeded' },
		select: { recordAId: true, recordBId: true }
	})
	const reusableKeys = new Set(
		reusableAssessments.map((row) => pairKey({ a: row.recordAId, b: row.recordBId }))
	)
	const { counts, blockers, contributors } = summarizePlan({
		recordCount: dataset.rowCount,
		comparison,
		vendorPairs: vendorPairs.flatMap((vendor) => vendor.pairs),
		reusableKeys,
		vendorCount: exports.length,
		jevFieldCount: jevFields.length,
		suggestions: { state: splink.state, reason: splink.reason }
	})

	// The pre-run check: how many of each vendor's pairs PairSight suggests by
	// itself, before adding the vendors' own. Vendor pairs are only checked
	// against here, never used to choose.
	const suggestedKeys = new Set(splink.pairs.map(pairKey))
	const vendorCheck = exports.map((vendorExport) => ({
		exportId: vendorExport.id,
		name: vendorExport.name,
		total: vendorExport.matches.length,
		found: vendorExport.matches.filter((match) =>
			suggestedKeys.has(pairKey({ a: match.recordAId, b: match.recordBId }))
		).length
	}))

	return {
		evaluation,
		dataset,
		exports: exports.map(({ id, name, pairCount }) => ({ id, name, pairCount })),
		comparison,
		config,
		judgmentKey: key,
		counts,
		blockers,
		contributors,
		vendorCheck,
		splink: {
			state: splink.state,
			reason: splink.reason,
			suggested: splink.suggested,
			reasons: splink.reasons
		}
	} as const
}
