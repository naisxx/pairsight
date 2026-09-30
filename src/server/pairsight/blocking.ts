import { LIMITS } from './limits'
import { normalizeField, type BlockingField, type MappedFields } from './normalize'
import { canonicalPair, groupPairCount, pairKey, type CanonicalPair } from './pairs'

// Overlapping blocking buckets (docs/PairSight-V1-Scope.md, "Blocking"): each
// rule is exact equality on one normalized field or a composite key, rules
// combine with OR, and a record can sit in several buckets. Blocking only
// proposes pairs worth checking — it never decides a match.

export type BlockingRule = { id: string; fields: BlockingField[] }

export const PRESET_RULES = [
	{ id: 'email', fields: ['email'] },
	{ id: 'phone', fields: ['phone'] },
	{ id: 'name', fields: ['name'] },
	{ id: 'name_postcode', fields: ['name', 'postcode'] }
] as const satisfies readonly BlockingRule[]

export type BlockingRecord = { id: string; fields: MappedFields }

export type RuleStats = {
	ruleId: string
	bucketCount: number
	pairCount: number
	largestBucket: number
	recordsWithoutKey: number
	oversizedBuckets: Array<{ size: number; pairCount: number }>
}

export type BlockingResult = {
	pairs: Array<CanonicalPair & { ruleIds: string[] }>
	stats: RuleStats[]
}

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
	return parts.join('\u0000')
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
				.map((members) => ({ size: members.length, pairCount: groupPairCount(members.length) }))
		}
	})
	return { pairs: [...pairs.values()], stats }
}
