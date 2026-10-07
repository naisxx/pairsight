// Why PairSight suggested a pair, as the codes the service writes
// (services/splink/pairsight_splink/reasons.py). The screens turn them into
// plain words; the service behind them is never named (docs/rules/copy.md).

export const SUGGESTION_REASONS = [
	'name_same',
	'name_swapped',
	'name_close',
	'surname_same',
	'first_name_same',
	'dob_same',
	'dob_close',
	'email_same',
	'email_username',
	'email_close',
	'phone_same',
	'postcode_same',
	'postcode_area',
	'city_same',
	'trading_name_same',
	'registration_same',
	'tax_id_same',
	'website_same',
	'gtin_same',
	'mpn_same',
	'sku_same',
	'brand_same',
	'brand_close',
	'manufacturer_same',
	'size_same',
	'color_same'
] as const

export type SuggestionReason = (typeof SUGGESTION_REASONS)[number]

export function isSuggestionReason(code: string): code is SuggestionReason {
	return SUGGESTION_REASONS.some((reason) => reason === code)
}

// The service's `;`-joined codes, known ones only, in their usual order.
export function parseReasons(joined: string): SuggestionReason[] {
	const codes = new Set(joined.split(';'))
	return SUGGESTION_REASONS.filter((reason) => codes.has(reason))
}

// How many suggested pairs carry each reason: what the Rules screen shows as
// "most suggested pairs share…". Most common first.
export function tallyReasons(
	pairs: Iterable<{ reasons: readonly SuggestionReason[] }>
): Array<{ reason: SuggestionReason; count: number }> {
	const counts = new Map<SuggestionReason, number>()
	for (const pair of pairs) {
		for (const reason of pair.reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1)
	}
	return [...counts]
		.map(([reason, count]) => ({ reason, count }))
		.sort((first, second) => second.count - first.count)
}
