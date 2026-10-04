import { z } from 'zod'
import { MAX_CUSTOM_RULES, MAX_RULE_FIELDS } from '@/lib/pairsight/custom-rules'
import { MAX_THRESHOLD, MIN_THRESHOLD } from '@/lib/pairsight/decisions'
import { COUNTRY_CODE_PATTERN } from '@/lib/pairsight/input-limits'
import { DERIVED_FIELDS, needsPartner, type DerivedField } from '@/lib/pairsight/derived-keys'
import { ENTITY_TYPES, MAX_PRESETS } from '@/lib/pairsight/entity-types'
import { FIELD_ROLES } from './fields'

// Runtime contracts for PairSight's JSON columns and action inputs. JSON read
// back from the database is parsed through these rather than cast.

export const fieldRoleSchema = z.enum(FIELD_ROLES)

export const identityRoleSchema = fieldRoleSchema.exclude(['other'])

const derivedFieldSchema = z.custom<DerivedField>(
	(value) => typeof value === 'string' && DERIVED_FIELDS.some((field) => field === value)
)

export const blockingFieldSchema = z.union([
	identityRoleSchema,
	z.literal('name'),
	derivedFieldSchema
])

// A rule's fields: at least one that isn't too broad on its own
// (derived-keys.ts, `needsPartner`).
export const ruleFieldsSchema = z
	.array(blockingFieldSchema)
	.min(1)
	.max(MAX_RULE_FIELDS)
	.refine((fields) => !needsPartner(fields), 'Add a field that narrows this rule down.')

// "custom_" plus three field names, derived ones included.
const MAX_RULE_ID_LENGTH = 96
const MAX_RULES = MAX_PRESETS + MAX_CUSTOM_RULES

export const entityTypeSchema = z.enum(ENTITY_TYPES)

export const blockingRuleSchema = z.object({
	id: z.string().min(1).max(MAX_RULE_ID_LENGTH),
	fields: ruleFieldsSchema
})

export const blockingRulesSchema = z.array(blockingRuleSchema).max(MAX_RULES)

export const columnRolesSchema = z.record(z.string(), fieldRoleSchema)

const MAX_DEFINITION_LENGTH = 2_000

export const identityDefinitionSchema = z.object({
	same: z.string().trim().min(1).max(MAX_DEFINITION_LENGTH),
	different: z.string().trim().min(1).max(MAX_DEFINITION_LENGTH)
})

export const countryCodeSchema = z
	.string()
	.trim()
	.regex(COUNTRY_CODE_PATTERN)
	.transform((value) => value.toUpperCase())

// Set in Rules: a preset or a custom value between the bounds.
export const thresholdSchema = z.number().min(MIN_THRESHOLD).max(MAX_THRESHOLD)

// Identity roles stored as plain strings (Evaluation.jevFields, Run.jevFields),
// keeping only valid ones.
export function parseIdentityRoles(fields: string[]): Array<z.infer<typeof identityRoleSchema>> {
	return fields.flatMap((field) => {
		const parsed = identityRoleSchema.safeParse(field)
		return parsed.success ? [parsed.data] : []
	})
}

export function isUuid(value: string): boolean {
	return z.string().uuid().safeParse(value).success
}

// A vendor file's columns: two references per row, or a group and a reference.
const columnNameSchema = z.string().min(1)
export const vendorColumnsSchema = z.discriminatedUnion('format', [
	z.object({ format: z.literal('pair'), columnA: columnNameSchema, columnB: columnNameSchema }),
	z.object({
		format: z.literal('group'),
		groupColumn: columnNameSchema,
		referenceColumn: columnNameSchema
	})
])

export const vendorFileStatsSchema = z.object({
	rows: z.number().int(),
	pairs: z.number().int(),
	groups: z.number().int().nullable(),
	duplicates: z.number().int(),
	selfPairs: z.number().int()
})

export const canonicalPairsSchema = z.array(z.object({ a: z.string(), b: z.string() }))
