import type { getTranslations } from 'next-intl/server'
import { RULE_COPY } from './rules/rule-copy'

type Translator = Awaited<ReturnType<typeof getTranslations>>

// Human label for a blocking rule id, using the run's frozen rule snapshot
// for custom rules.
export function ruleLabel({
	ruleId,
	rules,
	tRules,
	tRoles
}: {
	ruleId: string
	rules: Array<{ id: string; fields: string[] }>
	tRules: Translator
	tRoles: Translator
}): string {
	const title = RULE_COPY[ruleId]?.title
	if (title != null) return tRules(title)
	const rule = rules.find((candidate) => candidate.id === ruleId)
	return rule == null
		? ruleId
		: rule.fields.map((field) => tRoles(field)).join(` ${tRules('and')} `)
}
