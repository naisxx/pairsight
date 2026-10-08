import type { ResultFilters } from '@/server/pairsight/results'

// Opens the Overview's cut-off drawer on arrival (`?cutoff=open`): Detailed
// analysis links there to try another cut-off (cutoff-bar.tsx).
export const CUTOFF_OPEN_PARAM = 'cutoff'

// Result filters as URL query params, dropping empty values and page 1.
export function toQuery(
	filters: ResultFilters,
	overrides: Partial<ResultFilters> = {}
): Record<string, string> {
	const merged = { ...filters, ...overrides }
	return Object.fromEntries(
		Object.entries(merged).flatMap(([key, value]) =>
			value == null || value === '' || (key === 'page' && value === 1) ? [] : [[key, String(value)]]
		)
	)
}

export function hasActiveFilters(filters: ResultFilters): boolean {
	return (
		filters.category != null ||
		filters.source != null ||
		filters.lowConfidence != null ||
		filters.status != null ||
		filters.score != null ||
		(filters.q ?? '') !== ''
	)
}
