import 'server-only'
import { entityTypeOf } from '@/lib/pairsight/entity-types'
import { buildBlockedPairs, presetsFor, type BlockingRule, type RuleStats } from './blocking'
import { getCurrentDataset } from './datasets'
import { getVisibleEvaluation } from './evaluations'
import type { EvaluationScope } from './scope'
import { loadBlockingRecords } from './blocking-records'
import { mappedIdentityRoles } from './fields'
import { parseBlockingRules, parseColumnRoles } from './json'
import type { BlockingField } from './normalize'

// Live statistics for blocking rules before the user commits to them.
// Records are read once per request (blocking-records.ts); grouping 10,000
// of them by every rule takes well under a second.

async function loadBlockingInput({
	scope,
	evaluationId
}: {
	scope: EvaluationScope
	evaluationId: string
}) {
	const evaluation = await getVisibleEvaluation({ scope, id: evaluationId })
	const dataset = await getCurrentDataset(evaluationId)
	if (dataset == null) return { evaluation, dataset: null, records: [], mappedRoles: [] }
	const columnRoles = parseColumnRoles(dataset.columnRoles)
	return {
		evaluation,
		dataset,
		records: await loadBlockingRecords(dataset.id),
		mappedRoles: [...mappedIdentityRoles(columnRoles)]
	}
}

// Every preset (enabled or not) plus any saved custom rule, so the Rules
// screen can show what each rule would contribute before it's turned on.
export async function rulesPreview({
	scope,
	evaluationId
}: {
	scope: EvaluationScope
	evaluationId: string
}) {
	const { evaluation, records, mappedRoles } = await loadBlockingInput({ scope, evaluationId })
	const saved = parseBlockingRules(evaluation.blockingRules)
	const presets = presetsFor(entityTypeOf(evaluation.entityType))
	const rules: BlockingRule[] = [
		...presets.map((rule) => ({ id: rule.id, fields: [...rule.fields] })),
		...saved.filter((rule) => !presets.some((preset) => preset.id === rule.id))
	]
	// Only each rule's numbers: worked out from its groups, no pairs built.
	const { stats } = buildBlockedPairs({
		records,
		rules,
		country: evaluation.countryCode,
		countOnly: true
	})
	return { evaluation, saved, rules, mappedRoles, stats }
}

// One not-yet-saved rule, for the custom rule builder. The country is the
// draft one from the form, so phone keys match what the user is looking at.
export async function previewRuleStats({
	scope,
	evaluationId,
	fields,
	country
}: {
	scope: EvaluationScope
	evaluationId: string
	fields: BlockingField[]
	country: string
}): Promise<RuleStats | null> {
	const { records } = await loadBlockingInput({ scope, evaluationId })
	const rule = { id: 'preview', fields }
	return buildBlockedPairs({ records, rules: [rule], country, countOnly: true }).stats[0] ?? null
}
