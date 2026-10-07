import 'server-only'
import snapshotJson from '../../../prisma/demo/sandbox-snapshot.json'
import { CATEGORIES, categorize } from '@/lib/pairsight/decisions'
import { sandboxSnapshotSchema } from '@/lib/pairsight/sandbox-snapshot'
import { compareFields, type FieldComparison } from './compare'
import { FIELD_ROLES, type FieldRole } from './fields'
import { STORY_PAIR } from '@/components/pairsight/landing/sections'
import { parseReasons, type SuggestionReason } from './splink/reasons'

// The landing page's worked example: the people sandbox's real recorded run
// (prisma/demo/sandbox-snapshot.json), shaped for the hero's results panel and
// the "How it works" story. Real Jev scores and real vendor decisions, so the
// landing shows exactly what the product would.

// Example pairs the panel lists, per vendor and category: enough to open a
// few of each kind, without sending every pair's fields to the browser.
const EXAMPLES_PER_GROUP = 3

export type LandingVendor = {
	name: string
	fileName: string
	format: 'pair' | 'group'
	rows: number
}

// Every checked pair, as little as the panel's numbers need.
export type LandingScore = {
	score: number
	// Indexes into `vendors`.
	matchedBy: number[]
}

// A pair the panel lists and can open.
export type LandingPair = LandingScore & {
	key: string
	refs: [string, string]
	names: [string, string]
	// PairSight suggested it (rather than only a vendor matching it), and why.
	isSuggested: boolean
	reasons: SuggestionReason[]
	fields: FieldComparison[]
}

export type LandingDemo = {
	name: string
	recordsFile: string
	recordCount: number
	threshold: number
	vendors: LandingVendor[]
	scores: LandingScore[]
	examples: LandingPair[]
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

function buildDemo(): LandingDemo {
	const { dataset, vendors, run, evaluation } = snapshot
	// The sandbox's columns are named for their roles.
	const columnRoles: Record<string, FieldRole> = Object.fromEntries(
		FIELD_ROLES.filter((role) => evaluation.jevFields.includes(role)).map((role) => [role, role])
	)
	const byRef = new Map(dataset.records.map((record) => [record.reference, record.values]))
	const nameOf = (values: Record<string, string>) =>
		`${values.first_name ?? ''} ${values.last_name ?? ''}`.trim()
	const reasonsByKey = new Map<string, SuggestionReason[]>(
		dataset.suggestions.pairs.flatMap((pair) => {
			const [a, b] = pair.records
			const reasons = parseReasons(pair.reasons.join(';'))
			return [
				[`${a}-${b}`, reasons],
				[`${b}-${a}`, reasons]
			] satisfies Array<[string, SuggestionReason[]]>
		})
	)
	const judged = run.pairs.flatMap((pair) =>
		pair.assessment.score == null ? [] : [{ ...pair, score: pair.assessment.score }]
	)

	// A few of each kind, for each vendor, and the story's pair.
	const picked = new Set<string>([STORY_PAIR])
	for (const [index] of vendors.entries()) {
		for (const category of CATEGORIES) {
			judged
				.filter(
					(pair) =>
						categorize({
							status: 'succeeded',
							score: pair.score,
							isVendorMatch: pair.matchedBy.includes(index),
							threshold: run.threshold
						}) === category
				)
				.sort((first, second) => second.score - first.score)
				.slice(0, EXAMPLES_PER_GROUP)
				.forEach((pair) => picked.add(pair.records.join('-')))
		}
	}

	const examples = judged.flatMap((pair): LandingPair[] => {
		const key = pair.records.join('-')
		const [refA, refB] = pair.records
		const valuesA = byRef.get(refA)
		const valuesB = byRef.get(refB)
		if (!picked.has(key) || valuesA == null || valuesB == null) return []
		const { fields } = compareFields({
			valuesA,
			valuesB,
			columnRoles,
			country: evaluation.countryCode
		})
		return [
			{
				key,
				refs: [refA, refB],
				names: [nameOf(valuesA), nameOf(valuesB)],
				score: pair.score,
				matchedBy: pair.matchedBy,
				isSuggested: pair.isSuggested,
				reasons: reasonsByKey.get(key) ?? [],
				fields
			}
		]
	})
	return {
		name: evaluation.name,
		recordsFile: dataset.fileName,
		recordCount: dataset.records.length,
		threshold: run.threshold,
		vendors: vendors.map((vendor) => ({
			name: vendor.name,
			fileName: vendor.fileName,
			format: vendor.format,
			rows: rowsOf(vendor.stats)
		})),
		scores: judged.map(({ score, matchedBy }) => ({ score, matchedBy })),
		// The story's pair first, then Jev's surest.
		examples: examples.sort(
			(first, second) =>
				Number(second.key === STORY_PAIR) - Number(first.key === STORY_PAIR) ||
				second.score - first.score
		)
	}
}

const demo = buildDemo()

export function landingDemo(): LandingDemo {
	return demo
}
