import 'server-only'
import snapshotJson from '../../../prisma/demo/sandbox-snapshot.json'
import { sandboxSnapshotSchema } from '@/lib/pairsight/sandbox-snapshot'
import { compareFields, type FieldComparison } from './compare'
import { FIELD_ROLES, type FieldRole } from './fields'

// The landing page's worked example: the people sandbox's real recorded run
// (prisma/demo/sandbox-snapshot.json), shaped for the hero's results panel and
// the "How it works" story. Real Jev scores and real vendor decisions, so the
// landing shows exactly what the product would.

export type LandingVendor = {
	name: string
	fileName: string
	format: 'pair' | 'group'
	rows: number
}

export type LandingPair = {
	key: string
	refs: [string, string]
	names: [string, string]
	score: number
	// Indexes into `vendors`.
	matchedBy: number[]
	// The comparison rules that picked it.
	ruleIds: string[]
	fields: FieldComparison[]
}

export type LandingDemo = {
	name: string
	recordsFile: string
	recordCount: number
	threshold: number
	ruleIds: string[]
	vendors: LandingVendor[]
	pairs: LandingPair[]
}

const snapshot = sandboxSnapshotSchema.parse(snapshotJson)

function rowsOf(stats: unknown): number {
	return typeof stats === 'object' &&
		stats != null &&
		'rows' in stats &&
		typeof stats.rows === 'number'
		? stats.rows
		: 0
}

function ruleIdsOf(rules: unknown): string[] {
	if (!Array.isArray(rules)) return []
	return rules.flatMap((rule: unknown) =>
		typeof rule === 'object' && rule != null && 'id' in rule && typeof rule.id === 'string'
			? [rule.id]
			: []
	)
}

function buildDemo(): LandingDemo {
	const { dataset, vendors, run, evaluation } = snapshot
	// The sandbox's columns are named for their roles.
	const columnRoles: Record<string, FieldRole> = Object.fromEntries(
		FIELD_ROLES.filter((role) => evaluation.jevFields.includes(role)).map((role) => [role, role])
	)
	const byRef = new Map(dataset.records.map((record) => [record.reference, record.values]))
	const nameOf = (values: Record<string, string>) =>
		`${values.first_name ?? ''} ${values.last_name ?? ''}`.trim()
	const pairs = run.pairs.flatMap((pair): LandingPair[] => {
		const [refA, refB] = pair.records
		const valuesA = byRef.get(refA)
		const valuesB = byRef.get(refB)
		const score = pair.assessment.score
		if (valuesA == null || valuesB == null || score == null) return []
		const { fields } = compareFields({
			valuesA,
			valuesB,
			columnRoles,
			country: evaluation.countryCode
		})
		return [
			{
				key: `${refA}-${refB}`,
				refs: [refA, refB],
				names: [nameOf(valuesA), nameOf(valuesB)],
				score,
				matchedBy: pair.matchedBy,
				ruleIds: pair.ruleIds,
				fields
			}
		]
	})
	return {
		name: evaluation.name,
		recordsFile: dataset.fileName,
		recordCount: dataset.records.length,
		threshold: run.threshold,
		ruleIds: ruleIdsOf(evaluation.blockingRules),
		vendors: vendors.map((vendor) => ({
			name: vendor.name,
			fileName: vendor.fileName,
			format: vendor.format,
			rows: rowsOf(vendor.stats)
		})),
		pairs
	}
}

const demo = buildDemo()

export function landingDemo(): LandingDemo {
	return demo
}
