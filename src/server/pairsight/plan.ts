import 'server-only'
import { entityTypeOf } from '@/lib/pairsight/entity-types'
import { db } from '@/server/db/client'
import { buildBlockedPairs, type RuleStats } from './blocking'
import { summarizePlan, type PlanBlocker } from './plan-summary'
import { loadBlockingRecords } from './blocking-records'
import { mappedIdentityRoles } from './fields'
import { JEV_MODEL, judgmentKey, type JudgmentConfig } from './judgment'
import { buildComparisonSet, pairKey, type ComparisonPair } from './pairs'
import { parseIdentityRoles } from './schemas'
import { getCurrentDataset } from './datasets'
import { getVisibleEvaluation } from './evaluations'
import type { EvaluationScope } from './scope'
import { parseBlockingRules, parseColumnRoles } from './json'
import { LIMITS } from './limits'
import { splinkPicks } from './splink/picks'
import { SPLINK_RULE_ID } from './plan-summary'

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

	const columnRoles = parseColumnRoles(dataset.columnRoles)
	const [records, exports, splink] = await Promise.all([
		loadBlockingRecords(dataset.id),
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
		splinkPicks({ datasetId: dataset.id, isOn: evaluation.splinkPicks })
	])

	const mappedRoles = mappedIdentityRoles(columnRoles)
	const jevFields = parseIdentityRoles(evaluation.jevFields).filter((role) => mappedRoles.has(role))

	// Built up to a run's limit: past it the plan is blocked anyway, and a
	// runaway rule is counted but never built.
	const blocking = buildBlockedPairs({
		records,
		rules,
		country: evaluation.countryCode,
		maxPairs: LIMITS.maxPairsPerRun
	})
	// Splink's picks join the rules' pairs as one more source (`splink` among
	// a pair's reasons), so overlaps, the limit and runs treat them alike.
	const comparison: ComparisonPair[] = buildComparisonSet({
		blocked: [
			...blocking.pairs,
			...splink.pairs.map((pair) => ({ ...pair, ruleIds: [SPLINK_RULE_ID] }))
		],
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
		isComplete: blocking.isComplete,
		splinkPairCount: splink.pairs.length,
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
		contributors,
		splink: { state: splink.state, reason: splink.reason }
	} as const
}
