import 'server-only'
import { db } from '@/server/db/client'
import { buildBlockedPairs, RULE_PRESETS, type BlockingRule, type RuleStats } from './blocking'
import { getCurrentDataset } from './datasets'
import { getVisibleEvaluation } from './evaluations'
import type { EvaluationScope } from './scope'
import { isIdentityRole, mapRecordFields } from './fields'
import { parseBlockingRules, parseColumnRoles, parseRecordValues } from './json'
import type { BlockingField } from './normalize'

// Live statistics for blocking rules before the user commits to them.
// Records are capped at LIMITS.maxSourceRecords, so recomputing is cheap.

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
	const rows = await db.sourceRecord.findMany({
		where: { datasetId: dataset.id },
		select: { id: true, values: true }
	})
	return {
		evaluation,
		dataset,
		records: rows.map((record) => ({
			id: record.id,
			fields: mapRecordFields({ values: parseRecordValues(record.values), columnRoles })
		})),
		mappedRoles: [...new Set(Object.values(columnRoles).filter(isIdentityRole))]
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
	const rules: BlockingRule[] = [
		...RULE_PRESETS.map((rule) => ({ id: rule.id, fields: [...rule.fields] })),
		...saved.filter((rule) => !RULE_PRESETS.some((preset) => preset.id === rule.id))
	]
	const { stats } = buildBlockedPairs({ records, rules, country: evaluation.countryCode })
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
	return buildBlockedPairs({ records, rules: [rule], country }).stats[0] ?? null
}
