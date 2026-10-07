// Checks Results read from the database, on the runs in the local database:
//
// - They match Results worked out pair by pair in memory (the way they were
//   before docs/PairSight-Scale-Roadmap.md item 2): the summary against
//   `summarizePairs`, and every Detailed analysis list, its order and each
//   pair's position against result-rows.ts. Runs up to COMPARE_MAX_PAIRS.
// - Every query a Results request makes stays bounded on the biggest runs
//   (docs/rules/database.md, "Bounded queries"): its plan reaches judgments
//   and records only by index lookups, never by reading or hashing the
//   whole table. Plans only; nothing is run.
//
// It rebuilds each compared run's summary, as reading Results would.
//
// Usage: pnpm scale:check-results            (every finished run)
//        pnpm scale:check-results <runId>...

import assert from 'node:assert/strict'
import { db } from '../../src/server/db/client.ts'
import { parseColumnRoles, parseRecordValues } from '../../src/server/pairsight/json.ts'
import { summarizePairs, type RunSummary } from '../../src/server/pairsight/result-overview.ts'
import {
	applyFilters,
	buildRows,
	recordLabel,
	type ResultFilters,
	type ResultRow
} from '../../src/server/pairsight/result-rows.ts'
import { ensureRecordKeys } from '../../src/server/pairsight/record-keys.ts'
import { Prisma } from '../../src/server/db/client.ts'
import {
	pairPage,
	pairPosition,
	requestSql,
	type PairContext
} from '../../src/server/pairsight/results-query.ts'
import {
	buildRunSummary,
	readRunSummary,
	runVendors
} from '../../src/server/pairsight/run-summary.ts'
import { compareNatural } from '../../src/lib/pairsight/natural-key.ts'

// Every filter Detailed analysis offers, alone and in a few mixes.
const FILTERS: ResultFilters[] = [
	{},
	{ category: 'disagreements' },
	{ category: 'pairsight_only' },
	{ category: 'vendor_only', sort: 'score-asc' },
	{ category: 'both_matched', sort: 'score-desc' },
	{ category: 'neither_matched' },
	{ category: 'incomplete' },
	{ score: 'near' },
	{ score: 'above' },
	{ score: 'below' },
	{ score: 'r:0.3-0.4' },
	{ score: 'r:0.9-1.0' },
	{ source: 'suggested' },
	{ source: 'vendor', sort: 'score-asc' },
	{ lowConfidence: '1' },
	{ status: 'evaluated' },
	{ status: 'incomplete' },
	{ status: 'pending' },
	{ status: 'failed' },
	{ category: 'disagreements', score: 'near', source: 'suggested' }
]
// Runs compared pair by pair in memory, up to this size; bigger ones get the
// plan check only.
const COMPARE_MAX_PAIRS = 250_000
// The biggest runs whose request plans are checked.
const PLAN_RUNS = 3
// Runs big enough that a whole-run join is planned as hash tables.
const PLAN_PROOF_MIN_PAIRS = 50_000
// Tables a request may reach only by index lookups, a few rows each.
const LOOKUP_ONLY = new Set(['assessments', 'source_records'])
const INDEX_LOOKUPS = new Set(['Index Scan', 'Index Only Scan'])
// Positions checked per list: enough to cover its ends and middle.
const POSITIONS_PER_LIST = 5
const EVERYTHING = 1_000_000_000
const CATEGORY_ORDER = [
	'pairsight_only',
	'vendor_only',
	'both_matched',
	'neither_matched',
	'incomplete'
]

// result-rows.ts `applyFilters`' comparison, which the database must never
// contradict (it only adds the pair id for ties).
function compareRows(x: ResultRow, y: ResultRow, sort: ResultFilters['sort']): number {
	if (sort != null) {
		const direction = sort === 'score-asc' ? 1 : -1
		if (x.score == null || y.score == null) {
			return x.score == null && y.score == null ? 0 : x.score == null ? 1 : -1
		}
		return direction * (x.score - y.score)
	}
	return (
		CATEGORY_ORDER.indexOf(x.category) - CATEGORY_ORDER.indexOf(y.category) ||
		(y.score ?? -1) - (x.score ?? -1) ||
		compareNatural(x.recordA.reference, y.recordA.reference)
	)
}

// Arrays whose order carries no meaning, sorted so they compare.
function normalized(summary: RunSummary) {
	const key = (value: unknown) => JSON.stringify(value)
	const byKey = <T,>(list: T[]) => [...list].sort((a, b) => (key(a) < key(b) ? -1 : 1))
	return { ...summary, rows: byKey(summary.rows), sources: byKey(summary.sources) }
}

async function checkRun(runId: string) {
	const run = await db.run.findUniqueOrThrow({ where: { id: runId } })
	await ensureRecordKeys({ datasetId: run.datasetId, entityType: run.entityType })
	const [dataset, records, vendors, pairs] = await Promise.all([
		db.sourceDataset.findUniqueOrThrow({
			where: { id: run.datasetId },
			select: { columnRoles: true }
		}),
		db.sourceRecord.findMany({
			where: { datasetId: run.datasetId },
			select: { id: true, reference: true, values: true }
		}),
		runVendors(run.exportIds),
		db.runPair.findMany({
			where: { runId },
			select: {
				id: true,
				recordAId: true,
				recordBId: true,
				isSuggested: true,
				matchedByExportIds: true,
				assessment: {
					select: { status: true, score: true, errorCode: true, modelReported: true }
				}
			}
		})
	])
	const columnRoles = parseColumnRoles(dataset.columnRoles)
	const recordsById = new Map(
		records.map((record) => {
			const values = parseRecordValues(record.values)
			const label = recordLabel({
				values,
				columnRoles,
				reference: record.reference,
				entityType: run.entityType
			})
			return [record.id, { id: record.id, reference: record.reference, values, label }]
		})
	)
	const summaries = new Map(
		[...recordsById.values()].map(({ id, reference, label }) => [id, { id, reference, label }])
	)

	// The Overview's numbers.
	const started = performance.now()
	const fromDatabase = await buildRunSummary(run)
	const buildMs = Math.round(performance.now() - started)
	const reference = summarizePairs({
		pairs,
		records: recordsById,
		vendorIds: vendors.map((vendor) => vendor.id),
		threshold: run.threshold,
		columnRoles,
		country: run.countryCode
	})
	assert.deepEqual(normalized(fromDatabase), normalized(reference), 'summary')

	// Detailed analysis: every list, whole, for every vendor.
	let lists = 0
	for (const vendor of vendors) {
		const context: PairContext = {
			runId,
			threshold: run.threshold,
			vendorId: vendor.id
		}
		const rows = buildRows({
			pairs,
			records: summaries,
			threshold: run.threshold,
			vendorId: vendor.id
		})
		const searches: ResultFilters[] = [
			{ q: rows[0]?.recordA.reference.slice(0, 2) },
			{ q: rows[1]?.recordB.label.split(' ')[0]?.toUpperCase() }
		]
		for (const filters of [...FILTERS, ...searches]) {
			const expected = applyFilters(rows, filters)
			const actual = await pairPage({ context, filters, page: 1, size: EVERYTHING })
			const label = `${vendor.name} ${JSON.stringify(filters)}`
			assert.equal(actual.length, expected.length, `${label}: count`)
			const byId = new Map(expected.map((row) => [row.id, row]))
			for (const row of actual) assert.deepEqual(row, byId.get(row.id), `${label}: row ${row.id}`)
			actual.slice(1).forEach((row, index) => {
				const before = actual[index]
				if (before != null) {
					assert.ok(compareRows(before, row, filters.sort) <= 0, `${label}: order at ${index + 1}`)
				}
			})
			const step = Math.max(1, Math.floor(actual.length / POSITIONS_PER_LIST))
			for (let index = 0; index < actual.length; index += step) {
				const row = actual[index]
				if (row == null) continue
				assert.deepEqual(
					await pairPosition({ context, filters, pairId: row.id }),
					{
						position: index + 1,
						total: actual.length,
						previousId: actual[index - 1]?.id ?? null,
						nextId: actual[index + 1]?.id ?? null
					},
					`${label}: position of ${row.id}`
				)
			}
			lists++
		}
	}
	console.log(
		`run ${run.number} (${runId}): ${pairs.length} pairs, ${vendors.length} vendors, summary in ${buildMs} ms, ${lists} lists match`
	)
}

type PlanNode = {
	'Node Type': string
	'Relation Name'?: string
	'Parallel Aware'?: boolean
	Plans?: PlanNode[]
}

// Every node of a plan that reads a lookup-only table other than by index
// lookups for given rows: a scan of the whole table, a parallel read of it,
// or anything feeding a hash table (which reads it all to build one).
function unboundedReads(node: PlanNode, underHash = false): string[] {
	const relation = node['Relation Name']
	const isUnbounded =
		relation != null &&
		LOOKUP_ONLY.has(relation) &&
		(!INDEX_LOOKUPS.has(node['Node Type']) || node['Parallel Aware'] === true || underHash)
	const own = isUnbounded ? [`${node['Node Type']} on ${relation}`] : []
	const hashing = underHash || node['Node Type'] === 'Hash'
	return [...own, ...(node.Plans ?? []).flatMap((child) => unboundedReads(child, hashing))]
}

async function planOf(sql: Prisma.Sql): Promise<PlanNode> {
	const [row] = await db.$queryRaw<Array<{ 'QUERY PLAN': Array<{ Plan: PlanNode }> }>>(
		Prisma.sql`EXPLAIN (FORMAT JSON) ${sql}`
	)
	const plan = row?.['QUERY PLAN'][0]?.Plan
	assert.ok(plan != null, 'no plan')
	return plan
}

// The query that crashed Results at a million pairs: a count joining the
// whole run. The check must catch it, or it proves nothing.
const wholeRunJoin = (runId: string) => Prisma.sql`
	SELECT count(*) FROM run_pairs rp
	JOIN assessments a ON a.id = rp."assessmentId"
	JOIN source_records ra ON ra.id = rp."recordAId"
	JOIN source_records rb ON rb.id = rp."recordBId"
	WHERE rp."runId" = ${runId}::uuid`

async function checkPlans(runId: string) {
	const run = await db.run.findUniqueOrThrow({ where: { id: runId } })
	// Plans are read against the pairs as a Results request finds them.
	await readRunSummary(run)
	const vendors = await runVendors(run.exportIds)
	const [pair] = await db.runPair.findMany({ where: { runId }, take: 1, select: { id: true } })
	const context: PairContext = {
		runId,
		threshold: run.threshold,
		vendorId: vendors[0]?.id
	}
	const queries = FILTERS.flatMap((filters) => [
		{ name: 'count', filters, sql: requestSql.count(context, filters) },
		{ name: 'page 1', filters, sql: requestSql.page(context, filters, 1, 25) },
		{ name: 'a late page', filters, sql: requestSql.page(context, filters, 1000, 25) },
		{ name: 'position', filters, sql: requestSql.position(context, filters, pair?.id ?? runId) }
	])
	queries.push({
		name: 'rows by id',
		filters: {},
		sql: requestSql.byIds(context, pair == null ? [] : [pair.id])
	})
	// On a small run the planner may join it all by lookups anyway; the
	// check only proves itself where whole-run joins turn into hash tables.
	if (run.pairCount >= PLAN_PROOF_MIN_PAIRS) {
		assert.notDeepEqual(
			unboundedReads(await planOf(wholeRunJoin(runId))),
			[],
			'the plan check no longer catches a whole-run join'
		)
	}
	for (const { name, filters, sql } of queries) {
		const reads = unboundedReads(await planOf(sql))
		assert.deepEqual(
			reads,
			[],
			`${name} ${JSON.stringify(filters)} reads the whole table: ${reads.join(', ')}`
		)
	}
	console.log(
		`run ${run.number} (${runId}): ${run.pairCount} pairs, ${queries.length} request plans bounded`
	)
	if (run.pairCount < PLAN_PROOF_MIN_PAIRS) {
		console.log(`  (small run: seed a big one with pnpm scale:seed-run for a real plan check)`)
	}
}

const requested = process.argv.slice(2)
const finished = await db.run.findMany({
	where: { status: 'completed', ...(requested.length > 0 ? { id: { in: requested } } : {}) },
	orderBy: { pairCount: 'desc' },
	select: { id: true, pairCount: true }
})
let failed = 0
const attempt = async (runId: string, check: (runId: string) => Promise<void>) => {
	try {
		await check(runId)
	} catch (error) {
		failed++
		console.error(`run ${runId}: ${error instanceof Error ? error.message : String(error)}`)
	}
}
for (const run of finished.slice(0, PLAN_RUNS)) await attempt(run.id, checkPlans)
const compared = finished.filter((run) => run.pairCount <= COMPARE_MAX_PAIRS)
for (const run of compared) await attempt(run.id, checkRun)
await db.$disconnect()
console.log(
	`${failed === 0 ? 'All' : 'Not all'} checks passed: ${Math.min(PLAN_RUNS, finished.length)} runs' plans, ${compared.length} runs compared, ${failed} failed`
)
process.exitCode = failed > 0 ? 1 : 0
