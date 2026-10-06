import { LIMITS } from './limits'
import { ruleFieldKey } from './key-transforms'
import type { BlockingField, MappedFields } from './normalize'
import { canonicalPair, groupPairCount, pairKey, type CanonicalPair } from './pairs'

// Overlapping blocking buckets (docs/PairSight-V1-Scope.md, "Blocking"): each
// rule is exact equality on one normalized field or a composite key — a field
// may be derived ("surname sounds like", key-transforms.ts) — rules combine
// with OR, and a record can sit in several buckets. Blocking only proposes
// pairs worth checking — it never decides a match.

export type BlockingRule = { id: string; fields: BlockingField[] }

// The rules the Rules screen offers as toggles, per entity type
// (src/lib/pairsight/entity-types.ts).
export { ALL_PRESETS, presetsFor } from '@/lib/pairsight/entity-types'

export type BlockingRecord = { id: string; fields: MappedFields }

export type RuleStats = {
	ruleId: string
	bucketCount: number
	pairCount: number
	largestBucket: number
	recordsWithoutKey: number
	// Groups over the warning size, summed up: how many, the pairs they make
	// together, and the biggest one. One line however many groups there are
	// (a big file can have hundreds). Null when none is that big.
	oversized: { groups: number; pairCount: number; largest: number } | null
	// One normalized key, field by field, to show what the rule compares on:
	// a shared bucket's if there is one. Null when no record has a key.
	sampleKey: string[] | null
}

export type BlockingResult = {
	pairs: Array<CanonicalPair & { ruleIds: string[] }>
	stats: RuleStats[]
	// False when building stopped at `maxPairs`: there are more pairs than
	// that, and `pairs` holds only some of them.
	isComplete: boolean
}

const KEY_SEPARATOR = '\u0000'

function blockingKey({
	record,
	rule,
	country
}: {
	record: BlockingRecord
	rule: BlockingRule
	country: string
}): string | null {
	const parts: string[] = []
	for (const field of rule.fields) {
		const value = ruleFieldKey({ field, fields: record.fields, country })
		if (value == null) return null
		parts.push(value)
	}
	return parts.join(KEY_SEPARATOR)
}

function oversizedGroups(groups: string[][]): RuleStats['oversized'] {
	let count = 0
	let pairCount = 0
	let largest = 0
	for (const members of groups) {
		if (members.length <= LIMITS.bucketWarningSize) continue
		count++
		pairCount += groupPairCount(members.length)
		largest = Math.max(largest, members.length)
	}
	return count === 0 ? null : { groups: count, pairCount, largest }
}

// Every rule's groups and its exact pair count, worked out from group sizes;
// then, unless `countOnly`, the pairs themselves, deduplicated across rules.
// Building stops once there are more than `maxPairs` (a run's limit), so a
// runaway group (thousands of records sharing a key: millions of pairs) is
// counted but never built, and a page stays quick whatever the rules pick.
export function buildBlockedPairs({
	records,
	rules,
	country,
	maxPairs = Number.POSITIVE_INFINITY,
	countOnly = false
}: {
	records: BlockingRecord[]
	rules: BlockingRule[]
	country: string
	maxPairs?: number
	countOnly?: boolean
}): BlockingResult {
	const pairs = new Map<string, CanonicalPair & { ruleIds: string[] }>()
	let isComplete = true
	const stats = rules.map((rule) => {
		const buckets = new Map<string, string[]>()
		let recordsWithoutKey = 0
		for (const record of records) {
			const key = blockingKey({ record, rule, country })
			if (key == null) {
				recordsWithoutKey++
				continue
			}
			const members = buckets.get(key)
			if (members == null) buckets.set(key, [record.id])
			else members.push(record.id)
		}
		const shared = [...buckets.values()].filter((members) => members.length > 1)
		const sample =
			[...buckets.entries()].find(([, members]) => members.length > 1)?.[0] ??
			[...buckets.keys()][0] ??
			null
		// Record ids are unique, so a group of n makes n(n−1)/2 pairs.
		const pairCount = shared.reduce((sum, members) => sum + groupPairCount(members.length), 0)
		if (!countOnly && isComplete) {
			if (pairCount > maxPairs) isComplete = false
			else isComplete = addPairs({ pairs, groups: shared, ruleId: rule.id, maxPairs })
		}
		return {
			ruleId: rule.id,
			bucketCount: shared.length,
			pairCount,
			largestBucket: shared.reduce((largest, members) => Math.max(largest, members.length), 0),
			recordsWithoutKey,
			oversized: oversizedGroups(shared),
			sampleKey: sample == null ? null : sample.split(KEY_SEPARATOR)
		}
	})
	return { pairs: isComplete ? [...pairs.values()] : [], stats, isComplete }
}

// One rule's pairs added to the rest; false once there are more than
// `maxPairs`, when it stops.
function addPairs({
	pairs,
	groups,
	ruleId,
	maxPairs
}: {
	pairs: Map<string, CanonicalPair & { ruleIds: string[] }>
	groups: string[][]
	ruleId: string
	maxPairs: number
}): boolean {
	for (const members of groups) {
		for (let index = 0; index < members.length; index++) {
			const first = members[index]
			for (let other = index + 1; other < members.length; other++) {
				const second = members[other]
				if (first == null || second == null) continue
				const pair = canonicalPair(first, second)
				if (pair == null) continue
				const key = pairKey(pair)
				const existing = pairs.get(key)
				if (existing != null) {
					if (!existing.ruleIds.includes(ruleId)) existing.ruleIds.push(ruleId)
					continue
				}
				if (pairs.size >= maxPairs) return false
				pairs.set(key, { ...pair, ruleIds: [ruleId] })
			}
		}
	}
	return true
}
