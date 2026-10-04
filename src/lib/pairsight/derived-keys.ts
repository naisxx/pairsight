import { IDENTITY_ROLES, type BaseField } from '@/lib/pairsight/entity-types'

// Derived rule fields: a rule can match on something computed from a field
// ("surname sounds like", "birth year") instead of the field itself. That is
// fuzzy blocking done the cheap, explainable way — still exact equality, on a
// looser key (docs/PairSight-V1-Scope.md, "Blocking"). Stored as
// `field~transform`, so rules, run snapshots and rule ids stay plain strings
// and every rule saved before this still reads the same. Client-safe: the
// keys themselves are computed in src/server/pairsight/key-transforms.ts.

export const KEY_TRANSFORMS = [
	'sound',
	'prefix',
	'words',
	'initial',
	'local',
	'domain',
	'year',
	'district',
	'last7'
] as const

export type KeyTransform = (typeof KEY_TRANSFORMS)[number]

export type DerivedField = `${BaseField}~${KeyTransform}`

const SEPARATOR = '~'

// Which fields each transform makes sense on, and whether it's too broad to
// be a rule by itself (every Gmail address shares a domain; a birth year is
// shared by hundreds) — those only count beside another field.
export const TRANSFORM_CATALOG: Record<
	KeyTransform,
	{ fields: readonly BaseField[]; needsPartner: boolean }
> = {
	sound: {
		fields: ['name', 'first_name', 'last_name', 'company_name', 'trading_name'],
		needsPartner: false
	},
	prefix: {
		fields: ['name', 'first_name', 'last_name', 'company_name', 'product_name'],
		needsPartner: false
	},
	words: {
		fields: ['name', 'company_name', 'trading_name', 'product_name', 'address'],
		needsPartner: false
	},
	initial: { fields: ['first_name'], needsPartner: true },
	local: { fields: ['email'], needsPartner: false },
	domain: { fields: ['email'], needsPartner: true },
	year: { fields: ['date_of_birth'], needsPartner: true },
	district: { fields: ['postcode'], needsPartner: true },
	last7: { fields: ['phone'], needsPartner: false }
}

// Every derived field there is, in catalog order.
export const DERIVED_FIELDS: readonly DerivedField[] = KEY_TRANSFORMS.flatMap((transform) =>
	TRANSFORM_CATALOG[transform].fields.map(
		(field): DerivedField => `${field}${SEPARATOR}${transform}`
	)
)

export function transformsFor(field: BaseField): KeyTransform[] {
	return KEY_TRANSFORMS.filter((transform) => TRANSFORM_CATALOG[transform].fields.includes(field))
}

export function derivedField(field: BaseField, transform: KeyTransform): DerivedField {
	return `${field}${SEPARATOR}${transform}`
}

function isBaseField(value: string): value is BaseField {
	return value === 'name' || IDENTITY_ROLES.some((role) => role === value)
}

function isKeyTransform(value: string): value is KeyTransform {
	return KEY_TRANSFORMS.some((transform) => transform === value)
}

// A rule field split into the field it reads and how (null: as it is).
export function parseRuleField(field: BaseField | DerivedField): {
	base: BaseField
	transform: KeyTransform | null
} {
	const [base = '', transform] = field.split(SEPARATOR)
	if (!isBaseField(base)) throw new Error(`Unknown rule field: ${field}`)
	if (transform == null) return { base, transform: null }
	if (!isKeyTransform(transform)) throw new Error(`Unknown rule field: ${field}`)
	return { base, transform }
}

// A stored rule field this code knows, plain or derived: what a label can be
// built from.
export function isBlockingField(value: string): value is BaseField | DerivedField {
	return isBaseField(value) || DERIVED_FIELDS.some((field) => field === value)
}

export function isDerivedField(field: string): boolean {
	return field.includes(SEPARATOR)
}

// A rule with any derived field: what the Rules screen tags "Fuzzy", and
// what makes a pair found only by such rules a hard case on Results.
export function isFuzzyRule(rule: { fields: readonly string[] }): boolean {
	return rule.fields.some(isDerivedField)
}

// A rule made only of too-broad fields would bucket half the file together.
export function needsPartner(fields: ReadonlyArray<BaseField | DerivedField>): boolean {
	return (
		fields.length > 0 &&
		fields.every((field) => {
			const { transform } = parseRuleField(field)
			return transform != null && TRANSFORM_CATALOG[transform].needsPartner
		})
	)
}
