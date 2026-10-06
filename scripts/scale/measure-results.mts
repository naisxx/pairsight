// Times Results on one finished run in the local database
// (docs/PairSight-Scale-Roadmap.md, item 2): building its summary, reading
// the Overview, Detailed analysis pages under several filters and sorts,
// search, a pair's position, and the whole findings CSV with its memory.
// Read-only: the summary is built but not stored.
//
// Usage: pnpm scale:measure-results <runId>
//        (pnpm scale:seed-run makes a run to measure)

import { db } from '../../src/server/db/client.ts'
import { buildOverview } from '../../src/server/pairsight/result-overview.ts'
import { ensureRecordKeys } from '../../src/server/pairsight/record-keys.ts'
import {
	countPairs,
	runPairPages,
	pairPage,
	pairPosition,
	pairRowsByIds,
	type PairContext
} from '../../src/server/pairsight/results-query.ts'
import type { ResultFilters } from '../../src/server/pairsight/result-rows.ts'
import {
	buildRunSummary,
	fuzzyRuleIdsOf,
	readRunSummary,
	runVendors
} from '../../src/server/pairsight/run-summary.ts'
import { csvLines } from '../../src/server/pairsight/tabular/csv.ts'

const PAGE_SIZE = 25
const DEEP_PAGE_SHARE = 0.9
const MB = 1_000_000

const runId = process.argv[2]
if (runId == null) throw new Error('Usage: pnpm scale:measure-results <runId>')

const results: Array<[string, number]> = []
async function timed<T>(label: string, work: () => Promise<T>): Promise<T> {
	const started = performance.now()
	const result = await work()
	results.push([label, Math.round(performance.now() - started)])
	return result
}

const run = await db.run.findUniqueOrThrow({ where: { id: runId } })
await ensureRecordKeys({ datasetId: run.datasetId, entityType: run.entityType })
const vendors = await runVendors(run.exportIds)
const vendorId = vendors[0]?.id
const fuzzyRuleIds = fuzzyRuleIdsOf(run.blockingRules)
const context: PairContext = { runId, threshold: run.threshold, vendorId, fuzzyRuleIds }

await timed('summary built (background, when the run finishes)', () => buildRunSummary(run))
await timed('Overview read (stored summary + its top pairs)', async () => {
	const summary = await readRunSummary(run)
	const top = vendorId == null ? undefined : summary.top[vendorId]
	const [missed, merges] = await Promise.all([
		pairRowsByIds({ context, ids: top?.missed ?? [] }),
		pairRowsByIds({ context, ids: top?.merges ?? [] })
	])
	return buildOverview({ summary, vendors, vendorId, top: { missed, merges } })
})

const lists: Array<[string, ResultFilters]> = [
	['every pair, default order', {}],
	['every pair, by score', { sort: 'score-asc' }],
	['disagreements', { category: 'disagreements' }],
	['close calls', { score: 'near' }],
	['found only by close-match rules', { source: 'fuzzy' }],
	['Jev says same, by score', { score: 'above', sort: 'score-desc' }]
]
for (const [label, filters] of lists) {
	const matching = await timed(`count: ${label}`, () => countPairs({ context, filters }))
	await timed(`page 1: ${label}`, () => pairPage({ context, filters, page: 1, size: PAGE_SIZE }))
	const deep = Math.max(1, Math.floor((matching / PAGE_SIZE) * DEEP_PAGE_SHARE))
	await timed(`page ${deep}: ${label}`, () =>
		pairPage({ context, filters, page: deep, size: PAGE_SIZE })
	)
}
await timed('search "smith"', () =>
	pairPage({ context, filters: { q: 'smith' }, page: 1, size: PAGE_SIZE })
)
const [middle] = await pairPage({ context, filters: {}, page: 100, size: 1 })
if (middle != null) {
	await timed('pair position, every pair', () =>
		pairPosition({ context, filters: {}, pairId: middle.id })
	)
	await timed('pair position, disagreements', () =>
		pairPosition({ context, filters: { category: 'disagreements' }, pairId: middle.id })
	)
}

let peakRss = process.memoryUsage().rss
let bytes = 0
let rows = 0
await timed('findings CSV, every pair', async () => {
	for await (const page of runPairPages({ runId, datasetId: run.datasetId })) {
		rows += page.length
		bytes += csvLines(
			page.map((pair) => [pair.referenceA, pair.referenceB, String(pair.score)])
		).length
		peakRss = Math.max(peakRss, process.memoryUsage().rss)
	}
})

await db.$disconnect()
console.log(`Run ${run.number} (${runId}): ${run.pairCount.toLocaleString('en-GB')} pairs`)
for (const [label, ms] of results) console.log(`${String(ms).padStart(7)} ms  ${label}`)
console.log(
	`findings: ${rows.toLocaleString('en-GB')} rows streamed, ${(bytes / MB).toFixed(0)} MB of CSV (three columns), peak memory ${(peakRss / MB).toFixed(0)} MB`
)
