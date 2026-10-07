// What PairSight can evaluate: people, organisations or products. Everything
// that differs by type lives here — the fields a column can be mapped to, the
// record label, and how a pair is put to Jev — so the rest of the code asks this registry instead of assuming people.
// Client-safe: no server imports.

import type { DerivedField } from './derived-keys'

export const ENTITY_TYPES = ['person', 'company', 'product'] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

export const DEFAULT_ENTITY_TYPE: EntityType = 'person'

export function isEntityType(value: unknown): value is EntityType {
	return ENTITY_TYPES.some((type) => type === value)
}

// A stored type, or person: evaluations made before types existed, and ones
// whose records aren't saved yet, are read as people.
export function entityTypeOf(value: string | null | undefined): EntityType {
	return isEntityType(value) ? value : DEFAULT_ENTITY_TYPE
}

// Every identity field PairSight knows, once each. A role shared by several
// types (email, phone, the address lines) means the same thing in each, so
// one stored mapping is read the same way everywhere.
export const IDENTITY_ROLES = [
	'full_name',
	'first_name',
	'last_name',
	'email',
	'phone',
	'date_of_birth',
	'address',
	'city',
	'postcode',
	'country',
	'company_name',
	'trading_name',
	'registration_number',
	'tax_id',
	'website',
	'industry',
	'product_name',
	'brand',
	'manufacturer',
	'gtin',
	'mpn',
	'sku',
	'model_number',
	'category',
	'color',
	'size',
	'description'
] as const

export type IdentityRole = (typeof IDENTITY_ROLES)[number]

// Each type's fields, in the order its screens list them.
export const ROLES_BY_TYPE = {
	person: [
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
	],
	company: [
		'company_name',
		'trading_name',
		'registration_number',
		'tax_id',
		'website',
		'email',
		'phone',
		'address',
		'city',
		'postcode',
		'country',
		'industry'
	],
	product: [
		'product_name',
		'brand',
		'manufacturer',
		'gtin',
		'mpn',
		'sku',
		'model_number',
		'category',
		'color',
		'size',
		'description'
	]
} as const satisfies Record<EntityType, readonly IdentityRole[]>

// A field a record's cleaned keys are computed from (src/server/pairsight/
// match-keys.ts): an identity field, or the composite name (whichever name
// fields the mapping has: a full name, first + last, an organisation's or a
// product's name).
export type BaseField = IdentityRole | 'name'
// ...as it is, or derived from it ("surname sounds like"): derived-keys.ts.
export type KeyField = BaseField | DerivedField

type EntityConfig = {
	// The fields a record is shown by (results, pairs, exports), joined by a
	// space; the reference when none are filled.
	labelRoles: ReadonlyArray<readonly IdentityRole[]>
	// Values shown in a monospace font: codes, numbers, addresses on the web.
	monoRoles: readonly IdentityRole[]
	// How a pair is put to Jev. Person keeps the exact question it has always
	// had, so earlier judgments stay reusable.
	question: { id: string; instructions: string }
	identity: { same: string; different: string }
}

export const ENTITY_CONFIG: Record<EntityType, EntityConfig> = {
	person: {
		labelRoles: [['full_name'], ['first_name', 'last_name'], ['first_name'], ['last_name']],
		monoRoles: ['email', 'phone', 'date_of_birth', 'postcode'],
		question: {
			id: 'same_individual',
			instructions: 'Do record_1 and record_2 describe the same individual person?'
		},
		identity: {
			same: 'Both records describe the same individual person, even if details are formatted differently, misspelled, abbreviated or out of date.',
			different:
				'The records describe different people, including relatives or people who share a household, address, phone number or email.'
		}
	},
	company: {
		labelRoles: [['company_name'], ['trading_name']],
		monoRoles: ['registration_number', 'tax_id', 'website', 'email', 'phone', 'postcode'],
		question: {
			id: 'same_organisation',
			instructions: 'Do record_1 and record_2 describe the same organisation (legal entity)?'
		},
		identity: {
			same: 'Both records describe the same organisation (the same legal entity), even if it appears under a trading name, an abbreviation, an old address or different formatting.',
			different:
				'The records describe different organisations, including a parent and its subsidiary, branches registered separately, or unrelated companies that share an address, phone number or similar name.'
		}
	},
	product: {
		labelRoles: [['brand', 'product_name'], ['product_name']],
		monoRoles: ['gtin', 'mpn', 'sku', 'model_number'],
		question: {
			id: 'same_product',
			instructions: 'Do record_1 and record_2 describe the same product?'
		},
		identity: {
			same: 'Both records describe the same product (the same item in the same variant), even if the name, description or formatting differs.',
			different:
				'The records describe different products, including different variants (size, colour, capacity or edition), bundles or multipacks of the item, or similarly named products from different brands.'
		}
	}
}

export function rolesFor(type: EntityType): readonly IdentityRole[] {
	return ROLES_BY_TYPE[type]
}

// The fewest records PairSight can learn which pairs to suggest from
// (src/server/pairsight/splink/; MIN_RECORDS in
// services/splink/pairsight_splink/model.py): a smaller file is refused.
export const MIN_RECORDS = 200

// Fields Jev must be sent: one alone can't tell two records apart.
export const MIN_JEV_FIELDS = 2

// A record's display name from its type's label fields, or null.
export function labelFor(
	type: EntityType,
	fields: Partial<Record<IdentityRole, string>>
): string | null {
	for (const roles of ENTITY_CONFIG[type].labelRoles) {
		const parts = roles.map((role) => fields[role]?.trim() ?? '')
		if (parts.every((part) => part !== '')) return parts.join(' ')
	}
	return null
}
