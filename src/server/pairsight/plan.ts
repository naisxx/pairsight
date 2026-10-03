import 'server-only'
import { entityTypeOf } from '@/lib/pairsight/entity-types'
import { db } from '@/server/db/client'
import { buildBlockedPairs, type RuleStats } from './blocking'
import { summarizePlan, type PlanBlocker } from './plan-summary'
import { mapRecordFields, mappedIdentityRoles } from './fields'
import { JEV_MODEL, judgmentKey, type JudgmentConfig } from './judgment'
import { buildComparisonSet, pairKey, type ComparisonPair } from './pairs'
import { parseIdentityRoles } from './schemas'
import { getCurrentDataset } from './datasets'
import { getVisibleEvaluation } from './evaluations'
import type { EvaluationScope } from './scope'
import { parseBlockingRules, parseColumnRoles, parseRecordValues } from './json'

// The comparison plan: what a run *would* evaluate right now. Shared by the
// Plan screen and by startRun, so what the user reviews is exactly what runs.

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
	const rules = parseBlockingRules(evaluation.blockingRules)
	if (dataset == null) {
		const blockers: PlanBlocker[] = ['no_dataset']
		return { evaluation, dataset, rules, blockers } as const
	}

	const [records, exports] = await Promise.all([
		db.sourceRecord.findMany({
			where: { datasetId: dataset.id },
			select: { id: true, values: true }
		}),
		db.vendorExport.findMany({
			where: { evaluationId, datasetId: dataset.id },
			orderBy: { createdAt: 'asc' },
			select: {
				id: true,
				name: true,
				pairCount: true,
				matches: { select: { recordAId: true, recordBId: true } }
			}
		})
	])

	const columnRoles = parseColumnRoles(dataset.columnRoles)
	const mappedRoles = mappedIdentityRoles(columnRoles)
	const jevFields = parseIdentityRoles(evaluation.jevFields).filter((role) => mappedRoles.has(role))

	const blocking = buildBlockedPairs({
		records: records.map((record) => ({
			id: record.id,
			fields: mapRecordFields({ values: parseRecordValues(record.values), columnRoles })
		})),
		rules,
		country: evaluation.countryCode
	})
	const comparison: ComparisonPair[] = buildComparisonSet({
		blocked: blocking.pairs,
		vendorPairs: exports.map((vendorExport) => ({
			exportId: vendorExport.id,
			pairs: vendorExport.matches.map((match) => ({ a: match.recordAId, b: match.recordBId }))
		}))
	})

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
		recordCount: records.length,
		rules,
		ruleStats: blocking.stats,
		blockedPairCount: blocking.pairs.length,
		comparison,
		vendorPairs: exports.flatMap((vendorExport) =>
			vendorExport.matches.map((match) => ({ a: match.recordAId, b: match.recordBId }))
		),
		reusableKeys,
		vendorCount: exports.length,
		jevFieldCount: jevFields.length
	})

	return {
		evaluation,
		dataset,
		rules,
		ruleStats: blocking.stats satisfies RuleStats[],
		exports: exports.map(({ id, name, pairCount }) => ({ id, name, pairCount })),
		comparison,
		config,
		judgmentKey: key,
		counts,
		blockers,
		contributors
	} as const
}
