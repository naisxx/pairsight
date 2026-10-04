import { buildBlockedPairs, type BlockingRecord, type BlockingRule } from './blocking'
import { canonicalPair, groupPairCount, pairKey } from './pairs'

// How good a set of blocking rules is, measured on a file whose duplicates
// are known (scripts/blocking-check/): how many of them the rules would put
// in front of Jev, and at what cost. No Jev, no database.
//
// - Pair completeness: known duplicates among the candidate pairs ÷ all known
//   duplicates. Blocking's recall: a duplicate outside it is never judged.
// - Reduction ratio: the share of all possible pairs the rules spare Jev.

export type KnownDuplicate = { recordA: string; recordB: string; kind: string }

export type BlockingQuality = {
	pairCount: number
	found: number
	known: number
	completeness: number
	reductionRatio: number
	missed: KnownDuplicate[]
}

export function blockingQuality({
	records,
	rules,
	duplicates,
	country
}: {
	records: BlockingRecord[]
	rules: BlockingRule[]
	duplicates: KnownDuplicate[]
	country: string
}): BlockingQuality {
	const { pairs } = buildBlockedPairs({ records, rules, country })
	const candidates = new Set(pairs.map(pairKey))
	const missed = duplicates.filter((duplicate) => {
		const pair = canonicalPair(duplicate.recordA, duplicate.recordB)
		return pair == null || !candidates.has(pairKey(pair))
	})
	const found = duplicates.length - missed.length
	const possible = groupPairCount(records.length)
	return {
		pairCount: pairs.length,
		found,
		known: duplicates.length,
		completeness: duplicates.length === 0 ? 1 : found / duplicates.length,
		reductionRatio: possible === 0 ? 1 : 1 - pairs.length / possible,
		missed
	}
}
