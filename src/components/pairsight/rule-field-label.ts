import { parseRuleField } from '@/lib/pairsight/derived-keys'
import type { BlockingField } from '@/lib/pairsight/entity-types'

type Translate = (key: string, values?: Record<string, string>) => string

// A rule field for people: "Surname", or "Surname (sounds like)" when it's
// derived. Shared by the Rules screen, run cards, exports and the report, so
// a rule reads the same everywhere.
export function ruleFieldLabel({
	field,
	tRules,
	tRoles
}: {
	field: BlockingField
	tRules: Translate
	tRoles: Translate
}): string {
	const { base, transform } = parseRuleField(field)
	if (transform == null) return tRoles(base)
	return tRules('fieldDerived', {
		field: tRoles(base),
		transform: tRules(`transform.${transform}`)
	})
}
