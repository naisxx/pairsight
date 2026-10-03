import { NAME_SOURCES, type BlockingField, type IdentityRole } from '@/lib/pairsight/entity-types'

export type Rule = { id: string; fields: BlockingField[] }
export type RuleLimits = { bucketWarningSize: number; maxPairsPerRun: number }

// The first field a rule needs that isn't mapped (a "name" rule is satisfied
// by any of NAME_SOURCES: a full name, first + last, an organisation's or a
// product's name), or null when the rule can run.
export function missingField(fields: readonly BlockingField[], mapped: ReadonlySet<IdentityRole>) {
	for (const field of fields) {
		const isMissing =
			field === 'name'
				? !NAME_SOURCES.some((roles) => roles.every((role) => mapped.has(role)))
				: !mapped.has(field)
		if (isMissing) return field
	}
	return null
}

// The rules that can run on this mapping: what "rules on" counts everywhere,
// so a switched-on rule whose field isn't mapped is never counted.
export function runnableRules<T extends { fields: readonly BlockingField[] }>(
	rules: readonly T[],
	mapped: ReadonlySet<IdentityRole>
): T[] {
	return rules.filter((rule) => missingField(rule.fields, mapped) == null)
}
