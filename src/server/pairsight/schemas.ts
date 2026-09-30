import { z } from 'zod'
import { MAX_CUSTOM_RULES, MAX_RULE_FIELDS } from '@/lib/pairsight/custom-rules'
import { COUNTRY_CODE_PATTERN } from '@/lib/pairsight/input-limits'
import { RULE_PRESETS } from './blocking'
import { FIELD_ROLES } from './fields'

// Runtime contracts for PairSight's JSON columns and action inputs. JSON read
// back from the database is parsed through these rather than cast.

export const fieldRoleSchema = z.enum(FIELD_ROLES)

export const identityRoleSchema = fieldRoleSchema.exclude(['other'])

export const blockingFieldSchema = z.union([identityRoleSchema, z.literal('name')])

const MAX_RULE_ID_LENGTH = 64
const MAX_RULES = RULE_PRESETS.length + MAX_CUSTOM_RULES

export const blockingRuleSchema = z.object({
	id: z.string().min(1).max(MAX_RULE_ID_LENGTH),
	fields: z.array(blockingFieldSchema).min(1).max(MAX_RULE_FIELDS)
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

export const thresholdSchema = z.number().min(0).max(1)

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
