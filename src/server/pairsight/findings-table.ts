import {
	categorize,
	isLowConfidence,
	isPairsightMatch,
	type AssessmentStatus,
	type Category
} from '@/lib/pairsight/decisions'
import { failureReason, type FailureReason } from '@/lib/pairsight/failure-reasons'
import { compareNatural } from '@/lib/pairsight/natural-key'
import {
	FIELD_ROLES,
	isIdentityRole,
	mapRecordFields,
	type FieldRole,
	type IdentityRole
} from './fields'
import type { Table } from './tabular'

// A run's findings as a table (one row per pair, every vendor as columns),
// for export. Pure: the data and every word it writes come in, so it's tested
// without a database or translations.

const SCORE_DIGITS = 2

export type FindingsPair = {
	recordAId: string
	recordBId: string
	ruleIds: string[]
	matchedByExportIds: string[]
	assessment: {
		status: AssessmentStatus
		score: number | null
		errorCode: string | null
		modelReported: string | null
		completedAt: Date | null
	} | null
}

export type FindingsLabels = {
	recordA: string
	recordB: string
	field: (side: 'A' | 'B', role: IdentityRole) => string
	jevStatus: string
	jevScore: string
	jevModel: string
	assessedAt: string
	failure: string
	decision: string
	lowConfidence: string
	foundBy: string
	vendorDecision: (vendor: string) => string
	vendorCategory: (vendor: string) => string
	status: (status: AssessmentStatus) => string
	failureReason: (reason: FailureReason) => string
	match: string
	noMatch: string
	incomplete: string
	yes: string
	no: string
	matched: string
	notMatched: string
	addedByVendor: string
	category: (category: Category | 'incomplete') => string
	rule: (ruleId: string) => string
}

export type FindingsRecord = { reference: string; values: Record<string, string> }

// The findings file's header and how one pair becomes a row: shared by the
// whole-table build below and the streamed download (findings.ts).
export function findingsColumns({
	columnRoles,
	vendors,
	threshold,
	labels
}: {
	columnRoles: Record<string, FieldRole>
	vendors: Array<{ id: string; name: string }>
	threshold: number
	labels: FindingsLabels
}) {
	// Only the fields this dataset maps, in the usual field order.
	const mapped = new Set(Object.values(columnRoles))
	const roles = FIELD_ROLES.filter(isIdentityRole).filter((role) => mapped.has(role))
	const headers = [
		labels.recordA,
		labels.recordB,
		...roles.flatMap((role) => [labels.field('A', role), labels.field('B', role)]),
		labels.jevStatus,
		labels.jevScore,
		labels.jevModel,
		labels.assessedAt,
		labels.failure,
		labels.decision,
		labels.lowConfidence,
		labels.foundBy,
		...vendors.flatMap((vendor) => [
			labels.vendorDecision(vendor.name),
			labels.vendorCategory(vendor.name)
		])
	]
	const row = (
		pair: FindingsPair,
		recordA: FindingsRecord | undefined,
		recordB: FindingsRecord | undefined
	): string[] => {
		const status = pair.assessment?.status ?? 'pending'
		const score = pair.assessment?.score ?? null
		const isJudged = status === 'succeeded' && score != null
		const fieldsA = mapRecordFields({ values: recordA?.values ?? {}, columnRoles })
		const fieldsB = mapRecordFields({ values: recordB?.values ?? {}, columnRoles })
		return [
			recordA?.reference ?? '',
			recordB?.reference ?? '',
			...roles.flatMap((role) => [fieldsA[role] ?? '', fieldsB[role] ?? '']),
			labels.status(status),
			isJudged ? score.toFixed(SCORE_DIGITS) : '',
			pair.assessment?.modelReported ?? '',
			pair.assessment?.completedAt?.toISOString() ?? '',
			status === 'failed' ? labels.failureReason(failureReason(pair.assessment?.errorCode)) : '',
			isJudged
				? isPairsightMatch({ score, threshold })
					? labels.match
					: labels.noMatch
				: labels.incomplete,
			isJudged && isLowConfidence({ score, threshold }) ? labels.yes : labels.no,
			pair.ruleIds.length === 0 ? labels.addedByVendor : pair.ruleIds.map(labels.rule).join('; '),
			...vendors.flatMap((vendor) => {
				const isVendorMatch = pair.matchedByExportIds.includes(vendor.id)
				return [
					isVendorMatch ? labels.matched : labels.notMatched,
					labels.category(categorize({ isVendorMatch, status, score, threshold }))
				]
			})
		]
	}
	return { headers, row }
}

// The whole findings table at once, in the download's order: by record A's
// reference, then record B's, naturally (R2 before R10).
export function buildFindings({
	pairs,
	records,
	columnRoles,
	vendors,
	threshold,
	labels
}: {
	pairs: FindingsPair[]
	records: ReadonlyMap<string, FindingsRecord>
	columnRoles: Record<string, FieldRole>
	vendors: Array<{ id: string; name: string }>
	threshold: number
	labels: FindingsLabels
}): Table {
	const { headers, row } = findingsColumns({ columnRoles, vendors, threshold, labels })
	const reference = (id: string) => records.get(id)?.reference ?? ''
	const sorted = [...pairs].sort(
		(a, b) =>
			compareNatural(reference(a.recordAId), reference(b.recordAId)) ||
			compareNatural(reference(a.recordBId), reference(b.recordBId))
	)
	return {
		headers,
		rows: sorted.map((pair) => row(pair, records.get(pair.recordAId), records.get(pair.recordBId)))
	}
}
