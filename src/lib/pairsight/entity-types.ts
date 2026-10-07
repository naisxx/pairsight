// What PairSight can evaluate: people, organisations or products. Everything
// that differs by type lives here — the fields a column can be mapped to, the
// blocking presets and defaults, the record label, and how a pair is put to
// Jev — so the rest of the code asks this registry instead of assuming people.
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

// The composite "name" a blocking rule can key on: whichever name fields the
// mapping has. A mapping only ever holds one type's roles, so the sources
// never compete.
export const NAME_SOURCES: ReadonlyArray<readonly IdentityRole[]> = [
	['full_name'],
	['first_name', 'last_name'],
	['company_name'],
	['trading_name'],
	['product_name']
]

// A field a blocking rule can key on: an identity field, or the composite name.
export type BaseField = IdentityRole | 'name'
// ...as it is, or derived from it ("surname sounds like"): derived-keys.ts.
export type BlockingField = BaseField | DerivedField

export type RulePreset = { id: string; fields: readonly BlockingField[] }

type EntityConfig = {
	// Blocking presets the Rules screen offers as toggles, and which are on
	// for a new evaluation.
	presets: readonly RulePreset[]
	defaultRuleIds: readonly string[]
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
		presets: [
			{ id: 'email', fields: ['email'] },
			{ id: 'phone', fields: ['phone'] },
			{ id: 'name', fields: ['name'] },
			{ id: 'name_postcode', fields: ['name', 'postcode'] },
			{ id: 'last_name_postcode', fields: ['last_name', 'postcode'] },
			{ id: 'surname_sound_birth_year', fields: ['last_name~sound', 'date_of_birth~year'] },
			{ id: 'name_sound_district', fields: ['name~sound', 'postcode~district'] },
			{ id: 'email_username', fields: ['email~local'] }
		],
		defaultRuleIds: ['email', 'phone', 'name_postcode'],
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
		presets: [
			{ id: 'website', fields: ['website'] },
			{ id: 'registration_number', fields: ['registration_number'] },
			{ id: 'tax_id', fields: ['tax_id'] },
			{ id: 'phone', fields: ['phone'] },
			{ id: 'email', fields: ['email'] },
			{ id: 'name', fields: ['name'] },
			{ id: 'name_postcode', fields: ['name', 'postcode'] },
			{ id: 'name_city', fields: ['name', 'city'] },
			{ id: 'name_words_district', fields: ['name~words', 'postcode~district'] },
			{ id: 'name_prefix_city', fields: ['name~prefix', 'city'] }
		],
		defaultRuleIds: ['website', 'registration_number', 'name_postcode'],
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
		presets: [
			{ id: 'gtin', fields: ['gtin'] },
			{ id: 'mpn_brand', fields: ['mpn', 'brand'] },
			{ id: 'sku_brand', fields: ['sku', 'brand'] },
			{ id: 'name_brand', fields: ['name', 'brand'] },
			{ id: 'name', fields: ['name'] },
			{ id: 'name_words_brand', fields: ['name~words', 'brand'] }
		],
		defaultRuleIds: ['gtin', 'mpn_brand', 'name_brand'],
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

export function presetsFor(type: EntityType): readonly RulePreset[] {
	return ENTITY_CONFIG[type].presets
}

// Every preset of every type, once per id (a shared id like "email" means the
// same rule wherever it appears): how a saved rule is recognised as a preset.
export const ALL_PRESETS: readonly RulePreset[] = [
	...new Map(
		ENTITY_TYPES.flatMap((type) => ENTITY_CONFIG[type].presets).map((preset) => [preset.id, preset])
	).values()
]

export const MAX_PRESETS = Math.max(...ENTITY_TYPES.map((type) => presetsFor(type).length))

// The fewest records PairSight can learn which pairs to suggest from
// (src/server/pairsight/splink/; MIN_RECORDS in
// services/splink/pairsight_splink/model.py), for every type.
export const SUGGESTION_MIN_RECORDS = 200

// The rules an evaluation starts with: none where PairSight will suggest the
// pairs (the rules wait under Advanced), the type's defaults where it can't
// (too few records to learn from). Without a record count (a new
// evaluation, before its file), as if it can.
export function startingRules(
	type: EntityType,
	recordCount: number = SUGGESTION_MIN_RECORDS
): Array<{ id: string; fields: BlockingField[] }> {
	return recordCount >= SUGGESTION_MIN_RECORDS ? [] : defaultRules(type)
}

// The type's simple default rules: what a plan falls back to when nothing
// else picks pairs (src/server/pairsight/plan.ts).
export function defaultRules(type: EntityType): Array<{ id: string; fields: BlockingField[] }> {
	const { presets, defaultRuleIds } = ENTITY_CONFIG[type]
	return presets
		.filter((preset) => defaultRuleIds.includes(preset.id))
		.map((preset) => ({ id: preset.id, fields: [...preset.fields] }))
}

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
