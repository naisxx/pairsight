import type { BlockingField } from '@/server/pairsight/normalize'

// Custom blocking rules, shared by the Rules screen and the server's input
// schema. Kept outside src/server so the client builder can import it
// without pulling in the blocking engine (and libphonenumber with it).

export const MAX_RULE_FIELDS = 3
export const MAX_CUSTOM_RULES = 5

// Every field a rule can key on, in the order a custom rule's fields are
// stored — so "postcode + email" and "email + postcode" are one rule.
export const BLOCKING_FIELDS = [
	'name',
	'full_name',
	'first_name',
	'last_name',
	'email',
	'phone',
	'date_of_birth',
	'address',
	'city',
	'postcode',
	'country'
] as const satisfies readonly BlockingField[]

const CUSTOM_PREFIX = 'custom_'

export function isCustomRuleId(id: string): boolean {
	return id.startsWith(CUSTOM_PREFIX)
}

function canonicalFields(fields: readonly BlockingField[]): BlockingField[] {
	return BLOCKING_FIELDS.filter((field) => fields.includes(field))
}

export function customRule(fields: readonly BlockingField[]): {
	id: string
	fields: BlockingField[]
} {
	const ordered = canonicalFields(fields)
	return { id: `${CUSTOM_PREFIX}${ordered.join('_')}`, fields: ordered }
}

export function hasSameFields(
	first: readonly BlockingField[],
	second: readonly BlockingField[]
): boolean {
	const a = canonicalFields(first)
	const b = canonicalFields(second)
	return a.length === b.length && a.every((field, index) => field === b[index])
}
