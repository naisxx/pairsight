// Pair identity and the comparison set (docs/PairSight-V1-Scope.md, "Pairs
// and categories"). A pair is two different records, unordered; storing its
// ids in canonical order makes (A,B) and (B,A) the same pair, and self-pairs
// are never created.

export type CanonicalPair = { a: string; b: string }

export function canonicalPair(first: string, second: string): CanonicalPair | null {
	if (first === second) return null
	return first < second ? { a: first, b: second } : { a: second, b: first }
}

export function pairKey({ a, b }: CanonicalPair): string {
	return `${a}\u0000${b}`
}

// All unordered pairs within one group: n records give n(n-1)/2 pairs.
// Duplicate members count once.
export function expandGroup(memberIds: string[]): CanonicalPair[] {
	const members = [...new Set(memberIds)].sort()
	return members.flatMap((a, index) => members.slice(index + 1).map((b) => ({ a, b })))
}

export function groupPairCount(size: number): number {
	return (size * (size - 1)) / 2
}

export type ComparisonPair = CanonicalPair & {
	ruleIds: string[]
	matchedByExportIds: string[]
}

// Blocked pairs ∪ every vendor-matched pair, each appearing once. Vendor
// pairs outside the blocking rules are always included — that is the point.
export function buildComparisonSet({
	blocked,
	vendorPairs
}: {
	blocked: Array<CanonicalPair & { ruleIds: string[] }>
	vendorPairs: Array<{ exportId: string; pairs: CanonicalPair[] }>
}): ComparisonPair[] {
	const set = new Map<string, ComparisonPair>()
	const entry = (pair: CanonicalPair) => {
		const key = pairKey(pair)
		let existing = set.get(key)
		if (existing == null) {
			existing = { a: pair.a, b: pair.b, ruleIds: [], matchedByExportIds: [] }
			set.set(key, existing)
		}
		return existing
	}
	for (const pair of blocked) {
		const target = entry(pair)
		for (const ruleId of pair.ruleIds) {
			if (!target.ruleIds.includes(ruleId)) target.ruleIds.push(ruleId)
		}
	}
	for (const { exportId, pairs } of vendorPairs) {
		for (const pair of pairs) {
			const target = entry(pair)
			if (!target.matchedByExportIds.includes(exportId)) target.matchedByExportIds.push(exportId)
		}
	}
	return [...set.values()]
}
