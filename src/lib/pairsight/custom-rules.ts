import { DERIVED_FIELDS } from '@/lib/pairsight/derived-keys'
import { IDENTITY_ROLES, type BaseField, type BlockingField } from '@/lib/pairsight/entity-types'

// Custom blocking rules, shared by the Rules screen and the server's input
// schema. Kept outside src/server so the client builder can import it
// without pulling in the blocking engine (and libphonenumber with it).

export const MAX_RULE_FIELDS = 3
// Fields Jev must be sent: one alone can't tell two records apart.
export const MIN_JEV_FIELDS = 2
export const MAX_CUSTOM_RULES = 5

// Every field a rule can key on as it is, in the order the Rules screen
// offers them.
export const BLOCKING_FIELDS: readonly BaseField[] = ['name', ...IDENTITY_ROLES]

// The order a custom rule's fields are stored in, derived ones included — so
// "postcode + email" and "email + postcode" are one rule.
const RULE_FIELD_ORDER: readonly BlockingField[] = [...BLOCKING_FIELDS, ...DERIVED_FIELDS]

const CUSTOM_PREFIX = 'custom_'

export function isCustomRuleId(id: string): boolean {
	return id.startsWith(CUSTOM_PREFIX)
}

function canonicalFields(fields: readonly BlockingField[]): BlockingField[] {
	return RULE_FIELD_ORDER.filter((field) => fields.includes(field))
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
