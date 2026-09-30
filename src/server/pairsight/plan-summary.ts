import type { BlockingRule, RuleStats } from './blocking'
import { LIMITS } from './limits'
import { groupPairCount, pairKey, type ComparisonPair } from './pairs'

// The pure half of the comparison plan: counts, blockers, and — when the plan
// is over the cap — what is making it big. computePlan (plan.ts) loads the
// data; everything here is testable without a database.

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

// One source of pairs, largest first. Rules overlap, so rule contributions
// can add up to more than the unique total; vendor-only pairs never overlap
// a rule by definition.
export type PlanContributor =
	| {
			kind: 'rule'
			ruleId: string
			fields: BlockingRule['fields']
			pairCount: number
			largestBucket: number
	  }
	| { kind: 'vendors'; pairCount: number }

type VendorPair = { a: string; b: string }

export function summarizePlan({
	recordCount,
	rules,
	ruleStats,
	blockedPairCount,
	comparison,
	vendorPairs,
	reusableKeys,
	vendorCount,
	jevFieldCount
}: {
	recordCount: number
	rules: BlockingRule[]
	ruleStats: RuleStats[]
	blockedPairCount: number
	comparison: ComparisonPair[]
	vendorPairs: VendorPair[]
	reusableKeys: ReadonlySet<string>
	vendorCount: number
	jevFieldCount: number
}): { counts: PlanCounts; blockers: PlanBlocker[]; contributors: PlanContributor[] } {
	const reusable = comparison.filter((pair) => reusableKeys.has(pairKey(pair))).length
	const addedByVendorOnly = comparison.filter((pair) => pair.ruleIds.length === 0).length
	const counts: PlanCounts = {
		records: recordCount,
		blockedPairs: blockedPairCount,
		vendorPairs: new Set(vendorPairs.map(pairKey)).size,
		addedByVendorOnly,
		uniquePairs: comparison.length,
		allPossiblePairs: groupPairCount(recordCount),
		reusable,
		toEvaluate: comparison.length - reusable
	}

	const blockers: PlanBlocker[] = []
	if (vendorCount === 0) blockers.push('no_vendors')
	if (jevFieldCount === 0) blockers.push('no_jev_fields')
	if (comparison.length === 0) blockers.push('no_pairs')
	if (comparison.length > LIMITS.maxPairsPerRun) blockers.push('too_many_pairs')

	const ruleContributors: PlanContributor[] = rules.flatMap((rule) => {
		const stat = ruleStats.find((candidate) => candidate.ruleId === rule.id)
		return stat == null || stat.pairCount === 0
			? []
			: [
					{
						kind: 'rule' as const,
						ruleId: rule.id,
						fields: rule.fields,
						pairCount: stat.pairCount,
						largestBucket: stat.largestBucket
					}
				]
	})
	const contributors = [
		...ruleContributors,
		...(addedByVendorOnly > 0 ? [{ kind: 'vendors' as const, pairCount: addedByVendorOnly }] : [])
	].sort((first, second) => second.pairCount - first.pairCount)

	return { counts, blockers, contributors }
}
