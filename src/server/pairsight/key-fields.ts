import type { IdentityRole } from '@/lib/pairsight/entity-types'
import type { FieldComparison } from './compare'

// How strongly a shared value says two records are the same thing: an
// identifier first, then contact details and dates, then names, then
// descriptive values many records share.
const STRENGTH: IdentityRole[] = [
	'gtin',
	'registration_number',
	'tax_id',
	'email',
	'mpn',
	'sku',
	'phone',
	'website',
	'date_of_birth',
	'model_number',
	'full_name',
	'company_name',
	'product_name',
	'trading_name',
	'last_name',
	'address',
	'postcode',
	'first_name',
	'brand',
	'manufacturer',
	'city',
	'size',
	'color',
	'category',
	'industry',
	'country',
	'description'
]

const rank = (role: string) => {
	const index = STRENGTH.findIndex((strong) => strong === role)
	return index === -1 ? STRENGTH.length : index
}

// The few fields that say most about a pair, for the panel beside the
// Detailed analysis list: values both records have and Jev saw, the ones
// that match first (strongest identifiers first), then the strongest that
// differ. Everything else is on the pair's own page.
export function keyFields(
	fields: FieldComparison[],
	sentRoles: readonly string[],
	limit: number
): FieldComparison[] {
	const sent = new Set(sentRoles)
	const shown = fields.filter(
		(field) => sent.has(field.role) && field.a.trim() !== '' && field.b.trim() !== ''
	)
	const byStrength = (first: FieldComparison, second: FieldComparison) =>
		rank(first.role) - rank(second.role)
	const same = shown.filter((field) => field.comparison === 'same').sort(byStrength)
	const different = shown.filter((field) => field.comparison !== 'same').sort(byStrength)
	return [...same, ...different].slice(0, limit)
}
