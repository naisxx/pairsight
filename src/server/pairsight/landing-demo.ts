import 'server-only'
import peopleJson from '../../../prisma/demo/sandbox-snapshot.json'
import companiesJson from '../../../prisma/demo/sandbox-companies-snapshot.json'
import productsJson from '../../../prisma/demo/sandbox-products-snapshot.json'
import { categorize, isPairsightMatch, type Category } from '@/lib/pairsight/decisions'
import {
	possiblePairs,
	sensitivity,
	stableRange,
	vendorMetrics,
	type MetricPair
} from '@/lib/pairsight/metrics'
import { mosaicOf } from '@/lib/pairsight/mosaic'
import { rankVendors } from '@/lib/pairsight/ranking'
import { SANDBOX_BASE, SANDBOX_EVALUATION_IDS } from '@/lib/pairsight/sandbox'
import {
	SANDBOX_ID_KIND,
	sandboxId,
	sandboxSnapshotSchema,
	type SandboxSnapshot
} from '@/lib/pairsight/sandbox-snapshot'
import { compareFields, type Comparison } from './compare'
import { FIELD_ROLES, type FieldRole } from './fields'

// The landing page's figures (pairsight-handoff Landing): the products demo's
// real recorded run (prisma/demo/sandbox-products-snapshot.json), so every
// number, tile and pair on the page is what the demo itself shows. The
// ticker mixes pairs from all three demos.

// The pair the walkthrough follows: the same kettle written in capitals,
// with the part number on one side and the SKU on the other. Jev says same;
// one vendor merged it and the other didn't.
const STORY_PAIR = 'G001304-G001305'
// The values the walkthrough lays side by side, out of the ten Jev saw.
const STORY_ROLES = ['product_name', 'brand', 'gtin', 'mpn', 'sku', 'model_number'] as const
// What the walkthrough's record card shows of record A: what Jev reads.
const CARD_ROLES = ['product_name', 'gtin', 'model_number'] as const
// The pairs a figure lists on hover.
const FIGURE_EXAMPLES = 3
// Where in each demo's checked pairs (best score first) the ticker picks
// from: a spread from Jev's surest to its doubts.
const TICKER_QUANTILES = [0, 0.15, 0.4, 0.75, 0.97]

type Counts = Record<Category, number>

export type LandingVendor = {
	id: string
	name: string
	counts: Counts
	checked: number
	precision: number | null
	recall: number | null
	f1: number | null
	// One per checked pair, laid out by mosaicOf.
	tiles: Category[]
	// Its colour on every screen: its place in the upload order (vendor-swatch.tsx).
	colour: number
}

export type LandingPairName = {
	key: string
	a: string
	b: string
	score: number
	// Jev says same, at that demo's cut-off.
	isSame: boolean
}

export type LandingField = {
	role: (typeof STORY_ROLES)[number]
	a: string
	b: string
	comparison: Comparison
	isFormatOnly: boolean
}

export type LandingDemo = {
	resultsHref: string
	threshold: number
	recordCount: number
	possiblePairs: number
	suggested: number
	addedByVendors: number
	checked: number
	run: { number: number; model: string; createdAt: Date }
	// Best overall score first, as Results ranks them.
	vendors: LandingVendor[]
	story: {
		refs: [string, string]
		name: string
		score: number
		fields: LandingField[]
		card: Array<{ role: (typeof CARD_ROLES)[number]; value: string }>
		// What each vendor said about it, best overall score first.
		said: Array<{ name: string; isSame: boolean }>
	}
	// A pair a vendor merged that Jev doubts most.
	doubted: { name: string; score: number }
	// The cut-off range one vendor's figures don't move across, with its
	// correct merges and duplicates found along the sweep.
	steady: {
		vendor: string
		from: number
		to: number
		points: Array<{ threshold: number; precision: number | null; recall: number | null }>
	} | null
	// The leading vendor's pairs where both say same, Jev's surest first.
	agreedExamples: Array<{ key: string; name: string; score: number }>
	ticker: [LandingPairName[], LandingPairName[]]
}

const products = sandboxSnapshotSchema.parse(productsJson)

// A record as a person would name it: the product with its brand, the
// person, the company.
function displayName(values: Record<string, string>, withBrand = true): string {
	if (values.product_name != null) {
		return withBrand && values.brand
			? `${values.brand} ${values.product_name}`
			: values.product_name
	}
	if (values.company_name != null) return values.company_name
	return `${values.first_name ?? ''} ${values.last_name ?? ''}`.trim()
}

function checkedPairs(snapshot: SandboxSnapshot) {
	return snapshot.run.pairs.flatMap((pair) =>
		pair.assessment.score == null ? [] : [{ ...pair, score: pair.assessment.score }]
	)
}

function recordsOf(snapshot: SandboxSnapshot) {
	return new Map(snapshot.dataset.records.map((record) => [record.reference, record.values]))
}

function tickerPairs(snapshot: SandboxSnapshot): LandingPairName[] {
	const records = recordsOf(snapshot)
	const byScore = checkedPairs(snapshot).sort((first, second) => second.score - first.score)
	return TICKER_QUANTILES.flatMap((quantile) => {
		const pair = byScore[Math.min(byScore.length - 1, Math.floor(quantile * byScore.length))]
		const a = pair == null ? undefined : records.get(pair.records[0])
		const b = pair == null ? undefined : records.get(pair.records[1])
		return pair == null || a == null || b == null
			? []
			: [
					{
						key: pair.records.join('-'),
						a: displayName(a),
						b: displayName(b),
						score: pair.score,
						isSame: isPairsightMatch({ score: pair.score, threshold: snapshot.run.threshold })
					}
				]
	})
}

function buildDemo(): LandingDemo {
	const { dataset, run, evaluation } = products
	const threshold = run.threshold
	const records = recordsOf(products)
	const checked = checkedPairs(products)
	const vendorId = (index: number) => sandboxId(SANDBOX_ID_KIND.vendor, index + 1, 'product')
	const metricPairs = (index: number): MetricPair[] =>
		checked.map((pair) => ({
			status: 'succeeded',
			score: pair.score,
			isVendorMatch: pair.matchedBy.includes(index)
		}))

	const vendors = rankVendors(
		products.vendors.map((vendor, index) => {
			const metrics = vendorMetrics(metricPairs(index), threshold)
			const { both_matched, pairsight_only, vendor_only, neither_matched } = metrics.counts
			const counts: Counts = { both_matched, pairsight_only, vendor_only, neither_matched }
			return {
				id: vendorId(index),
				index,
				name: vendor.name,
				counts,
				checked: metrics.assessed,
				precision: metrics.precision,
				recall: metrics.recall,
				f1: metrics.f1,
				metrics,
				tiles: mosaicOf(counts).tiles
			}
		})
	)

	const storyPair = checked.find((pair) => pair.records.join('-') === STORY_PAIR)
	const [refA, refB] = storyPair?.records ?? ['', '']
	const valuesA = records.get(refA) ?? {}
	const valuesB = records.get(refB) ?? {}
	const columnRoles: Record<string, FieldRole> = Object.fromEntries(
		FIELD_ROLES.filter((role) => evaluation.jevFields.includes(role)).map((role) => [role, role])
	)
	const { fields } = compareFields({
		valuesA,
		valuesB,
		columnRoles,
		country: evaluation.countryCode
	})
	const storyFields = STORY_ROLES.flatMap((role) => {
		const field = fields.find((candidate) => candidate.role === role)
		return field == null
			? []
			: [
					{
						role,
						a: field.a,
						b: field.b,
						comparison: field.comparison,
						isFormatOnly: field.isFormatOnly
					}
				]
	})

	const doubtedPair = checked
		.filter((pair) => pair.matchedBy.length > 0)
		.sort((first, second) => first.score - second.score)[0]

	// The steadiest picture: the first vendor, best first, whose figures hold
	// over a stretch of cut-offs.
	const steady =
		vendors
			.map((vendor) => {
				const points = sensitivity(metricPairs(vendor.index))
				const range = stableRange(points, vendor.metrics, threshold)
				return range == null
					? null
					: {
							vendor: vendor.name,
							...range,
							points: points.map(({ threshold: at, precision, recall }) => ({
								threshold: at,
								precision,
								recall
							}))
						}
			})
			.find((candidate) => candidate != null) ?? null

	const leader = vendors[0]
	const agreedExamples =
		leader == null
			? []
			: checked
					.filter(
						(pair) =>
							categorize({
								status: 'succeeded',
								score: pair.score,
								isVendorMatch: pair.matchedBy.includes(leader.index),
								threshold
							}) === 'both_matched'
					)
					.sort((first, second) => second.score - first.score)
					.slice(0, FIGURE_EXAMPLES * 3)
					.map((pair) => ({
						key: pair.records.join('-'),
						name: displayName(records.get(pair.records[0]) ?? {}),
						score: pair.score
					}))

	const suggested = checked.filter((pair) => pair.isSuggested).length
	const perDemo = [
		products,
		...[peopleJson, companiesJson].map((json) => sandboxSnapshotSchema.parse(json))
	].map(tickerPairs)
	// Interleaved, so each row mixes products, people and companies.
	const ticker = Array.from(
		{ length: Math.max(...perDemo.map((pairs) => pairs.length)) },
		(_, index) =>
			perDemo.flatMap((pairs) => {
				const pair = pairs[index]
				return pair == null ? [] : [pair]
			})
	).flat()
	const half = Math.ceil(ticker.length / 2)

	return {
		resultsHref: `${SANDBOX_BASE}/${SANDBOX_EVALUATION_IDS.product}/runs/${sandboxId(SANDBOX_ID_KIND.run, 1, 'product')}/results`,
		threshold,
		recordCount: dataset.records.length,
		possiblePairs: possiblePairs(dataset.records.length),
		suggested,
		addedByVendors: checked.length - suggested,
		checked: checked.length,
		run: { number: run.number, model: run.jevModel, createdAt: new Date(run.createdAt) },
		vendors: vendors.map(
			({ id, index, name, counts, checked: assessed, precision, recall, f1, tiles }) => ({
				id,
				colour: index,
				name,
				counts,
				checked: assessed,
				precision,
				recall,
				f1,
				tiles
			})
		),
		story: {
			refs: [refA, refB],
			name: displayName(valuesA, false),
			score: storyPair?.score ?? 0,
			fields: storyFields,
			card: CARD_ROLES.map((role) => ({ role, value: valuesA[role] ?? '' })),
			said: vendors.map((vendor) => ({
				name: vendor.name,
				isSame: storyPair?.matchedBy.includes(vendor.index) ?? false
			}))
		},
		doubted: {
			name: displayName(records.get(doubtedPair?.records[0] ?? '') ?? {}, false),
			score: doubtedPair?.score ?? 0
		},
		steady,
		agreedExamples,
		ticker: [ticker.slice(0, half), ticker.slice(half)]
	}
}

const demo = buildDemo()

export function landingDemo(): LandingDemo {
	return demo
}
