import type { IdentityRole } from '@/server/pairsight/fields'
import type { BlockingField } from '@/server/pairsight/normalize'

export type Rule = { id: string; fields: BlockingField[] }
export type RuleLimits = { bucketWarningSize: number; maxPairsPerRun: number }

// The first field a rule needs that isn't mapped (a "name" rule is satisfied
// by a full name or by first + last), or null when the rule can run.
export function missingField(fields: readonly BlockingField[], mapped: ReadonlySet<IdentityRole>) {
	for (const field of fields) {
		const isMissing =
			field === 'name'
				? !mapped.has('full_name') && !(mapped.has('first_name') && mapped.has('last_name'))
				: !mapped.has(field)
		if (isMissing) return field
	}
	return null
}
