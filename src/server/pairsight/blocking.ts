import { LIMITS } from './limits'
import { normalizeField, type BlockingField, type MappedFields } from './normalize'
import { canonicalPair, groupPairCount, pairKey, type CanonicalPair } from './pairs'

// Overlapping blocking buckets (docs/PairSight-V1-Scope.md, "Blocking"): each
// rule is exact equality on one normalized field or a composite key, rules
// combine with OR, and a record can sit in several buckets. Blocking only
// proposes pairs worth checking — it never decides a match.

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
	oversizedBuckets: Array<{ size: number; pairCount: number }>
	// One normalized key, field by field, to show what the rule compares on:
	// a shared bucket's if there is one. Null when no record has a key.
	sampleKey: string[] | null
}

export type BlockingResult = {
	pairs: Array<CanonicalPair & { ruleIds: string[] }>
	stats: RuleStats[]
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
		const value = normalizeField({ field, fields: record.fields, country })
		if (value == null) return null
		parts.push(value)
	}
	return parts.join(KEY_SEPARATOR)
}

export function buildBlockedPairs({
	records,
	rules,
	country
}: {
	records: BlockingRecord[]
	rules: BlockingRule[]
	country: string
}): BlockingResult {
	const pairs = new Map<string, CanonicalPair & { ruleIds: string[] }>()
	const stats = rules.map((rule) => {
		const buckets = new Map<string, string[]>()
		let recordsWithoutKey = 0
		for (const record of records) {
			const key = blockingKey({ record, rule, country })
			if (key == null) {
				recordsWithoutKey++
				continue
			}
			buckets.set(key, [...(buckets.get(key) ?? []), record.id])
		}
		const shared = [...buckets.values()].filter((members) => members.length > 1)
		const sample =
			[...buckets.entries()].find(([, members]) => members.length > 1)?.[0] ??
			[...buckets.keys()][0] ??
			null
		let pairCount = 0
		for (const members of shared) {
			members.forEach((first, index) => {
				for (const second of members.slice(index + 1)) {
					const pair = canonicalPair(first, second)
					if (pair == null) continue
					pairCount++
					const key = pairKey(pair)
					const existing = pairs.get(key)
					if (existing == null) pairs.set(key, { ...pair, ruleIds: [rule.id] })
					else if (!existing.ruleIds.includes(rule.id)) existing.ruleIds.push(rule.id)
				}
			})
		}
		return {
			ruleId: rule.id,
			bucketCount: shared.length,
			pairCount,
			largestBucket: Math.max(0, ...shared.map((members) => members.length)),
			recordsWithoutKey,
			oversizedBuckets: shared
				.filter((members) => members.length > LIMITS.bucketWarningSize)
				.map((members) => ({ size: members.length, pairCount: groupPairCount(members.length) })),
			sampleKey: sample == null ? null : sample.split(KEY_SEPARATOR)
		}
	})
	return { pairs: [...pairs.values()], stats }
}
