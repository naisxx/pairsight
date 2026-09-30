import type { ResultFilters } from '@/server/pairsight/results'

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
		(filters.q ?? '') !== ''
	)
}
