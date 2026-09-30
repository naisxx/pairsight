import 'server-only'
import { db } from '@/server/db/client'
import { buildBlockedPairs, type RuleStats } from './blocking'
import { isIdentityRole, mapRecordFields } from './fields'
import { JEV_MODEL, judgmentKey, type JudgmentConfig } from './judgment'
import { LIMITS } from './limits'
import { buildComparisonSet, groupPairCount, pairKey, type ComparisonPair } from './pairs'
import { parseIdentityRoles } from './schemas'
import { getCurrentDataset } from './datasets'
import { getOwnedEvaluation } from './evaluations'
import { parseBlockingRules, parseColumnRoles, parseRecordValues } from './json'

// The comparison plan: what a run *would* evaluate right now. Shared by the
// Plan screen and by startRun, so what the user reviews is exactly what runs.

export type PlanBlocker =
	'no_dataset' | 'no_vendors' | 'no_jev_fields' | 'no_pairs' | 'too_many_pairs'

export type PlanCounts = {
	records: number
	blockedPairs: number
	vendorPairs: number
	addedByVendorOnly: number
	uniquePairs: number
	allPossiblePairs: number
	reusable: number
	toEvaluate: number
}

export async function computePlan({
	ownerId,
	evaluationId
}: {
	ownerId: string
	evaluationId: string
}) {
	const evaluation = await getOwnedEvaluation({ ownerId, id: evaluationId })
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
	const mappedRoles = new Set(Object.values(columnRoles).filter(isIdentityRole))
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
	const reusable = comparison.filter((pair) => reusableKeys.has(pairKey(pair))).length

	const vendorPairKeys = new Set(
		exports.flatMap((vendorExport) =>
			vendorExport.matches.map((match) => pairKey({ a: match.recordAId, b: match.recordBId }))
		)
	)
	const counts: PlanCounts = {
		records: records.length,
		blockedPairs: blocking.pairs.length,
		vendorPairs: vendorPairKeys.size,
		addedByVendorOnly: comparison.filter((pair) => pair.ruleIds.length === 0).length,
		uniquePairs: comparison.length,
		allPossiblePairs: groupPairCount(records.length),
		reusable,
		toEvaluate: comparison.length - reusable
	}

	const blockers: PlanBlocker[] = []
	if (exports.length === 0) blockers.push('no_vendors')
	if (jevFields.length === 0) blockers.push('no_jev_fields')
	if (comparison.length === 0) blockers.push('no_pairs')
	if (comparison.length > LIMITS.maxPairsPerRun) blockers.push('too_many_pairs')

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
		blockers
	} as const
}
