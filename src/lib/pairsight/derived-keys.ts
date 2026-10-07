import { IDENTITY_ROLES, type BaseField } from '@/lib/pairsight/entity-types'

// Derived keys: something computed from a field ("surname sounds like",
// "birth year") instead of the field itself, written for PairSight's pair
// suggestions (src/server/pairsight/splink/records.ts). Named `field~transform`.
// Client-safe: the keys themselves are computed in
// src/server/pairsight/match-keys.ts.

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

function isBaseField(value: string): value is BaseField {
	return value === 'name' || IDENTITY_ROLES.some((role) => role === value)
}

function isKeyTransform(value: string): value is KeyTransform {
	return KEY_TRANSFORMS.some((transform) => transform === value)
}

// A key field split into the field it reads and how (null: as it is).
export function parseKeyField(field: BaseField | DerivedField): {
	base: BaseField
	transform: KeyTransform | null
} {
	const [base = '', transform] = field.split(SEPARATOR)
	if (!isBaseField(base)) throw new Error(`Unknown key field: ${field}`)
	if (transform == null) return { base, transform: null }
	if (!isKeyTransform(transform)) throw new Error(`Unknown key field: ${field}`)
	return { base, transform }
}
