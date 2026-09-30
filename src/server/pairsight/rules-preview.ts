import 'server-only'
import { db } from '@/server/db/client'
import { buildBlockedPairs } from './blocking'
import { getCurrentDataset } from './datasets'
import { getOwnedEvaluation } from './evaluations'
import { isIdentityRole, mapRecordFields } from './fields'
import { parseBlockingRules, parseColumnRoles, parseRecordValues } from './json'
import type { BlockingField } from './normalize'

// Preset rules the Rules screen offers. `last_name_postcode` is not a default
// but is useful when names are recorded inconsistently.
export const RULE_PRESETS = [
	{ id: 'email', fields: ['email'] },
	{ id: 'phone', fields: ['phone'] },
	{ id: 'name', fields: ['name'] },
	{ id: 'name_postcode', fields: ['name', 'postcode'] },
	{ id: 'last_name_postcode', fields: ['last_name', 'postcode'] }
] as const satisfies ReadonlyArray<{ id: string; fields: BlockingField[] }>

// Live statistics for every preset (enabled or not) plus any saved custom
// rule, so the Rules screen can show what each rule would contribute before
// the user turns it on. Records are capped at LIMITS.maxSourceRecords, so
// this stays cheap.
export async function rulesPreview({
	ownerId,
	evaluationId
}: {
	ownerId: string
	evaluationId: string
}) {
	const evaluation = await getOwnedEvaluation({ ownerId, id: evaluationId })
	const dataset = await getCurrentDataset(evaluationId)
	const saved = parseBlockingRules(evaluation.blockingRules)
	if (dataset == null) return { evaluation, saved, mappedRoles: [], stats: [] }
	const columnRoles = parseColumnRoles(dataset.columnRoles)
	const records = await db.sourceRecord.findMany({
		where: { datasetId: dataset.id },
		select: { id: true, values: true }
	})
	const rules = [
		...RULE_PRESETS.map((rule) => ({ id: rule.id, fields: [...rule.fields] })),
		...saved.filter((rule) => !RULE_PRESETS.some((preset) => preset.id === rule.id))
	]
	const { stats } = buildBlockedPairs({
		records: records.map((record) => ({
			id: record.id,
			fields: mapRecordFields({ values: parseRecordValues(record.values), columnRoles })
		})),
		rules,
		country: evaluation.countryCode
	})
	return {
		evaluation,
		saved,
		mappedRoles: [...new Set(Object.values(columnRoles).filter(isIdentityRole))],
		stats
	}
}
