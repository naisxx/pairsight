import 'server-only'
import { db, Prisma } from '@/server/db/client'
import { LOW_CONFIDENCE_BAND } from '@/lib/pairsight/decisions'
import type { RuleKind, StatsRow } from '@/lib/pairsight/stats'
import type { SourceStat } from './result-overview'
import {
	buildRows,
	scoreRange,
	type AssessmentStatus,
	type RecordSummary,
	type ResultFilters,
	type ResultRow
} from './result-rows'

// Results read in the database, never by loading the run: the count table
// the Overview is built from (run-summary.ts), and Detailed analysis pages
// filtered, sorted and searched exactly as result-rows.ts does pair by pair.
//
// The rule that keeps this fast and safe at any size (docs/rules/database.md,
// "Bounded queries"): a request reads `run_pairs` alone, where each pair's
// status, score, sort key and search text are copied when the summary is
// built (`snapshotRunPairs`), and joins records and judgments only for the
// rows it returns. Joining the whole run per request makes Postgres build
// hash tables over every pair and record: work that grows with the run and,
// past a few hundred thousand pairs, runs the database out of shared memory.
// `pnpm scale:check-results` reads each request query's plan and fails on a
// whole-run join. Work over the whole run happens only while building the
// summary, in the background, a chunk of records at a time through indexes.
//
// These are $queryRaw (docs/rules/database.md): array tests (`= ANY`, `<@`,
// unnest), grouped counts, window functions for the pair's position and
// UPDATE ... FROM are beyond Prisma's query API. Every value is a bound
// parameter; only fixed fragments are composed. Records sort by their sortKey
// (natural-key.ts).

// What decides a pair's category for one vendor at one cut-off.
export type PairContext = {
	runId: string
	threshold: number
	// The vendor the categories are read for; none decides "not matched".
	vendorId: string | undefined
	fuzzyRuleIds: readonly string[]
}

const judged = Prisma.sql`(rp.status = 'succeeded' AND rp.score IS NOT NULL)`
const jevSame = (threshold: number) => Prisma.sql`(rp.score >= ${threshold}::float8)`
const near = (threshold: number) =>
	Prisma.sql`(abs(rp.score - ${threshold}::float8) < ${LOW_CONFIDENCE_BAND}::float8)`
const vendorSame = (vendorId: string | undefined) =>
	vendorId == null
		? Prisma.sql`FALSE`
		: Prisma.sql`(${vendorId}::text = ANY(rp."matchedByExportIds"))`
const fuzzyOnly = (fuzzyRuleIds: readonly string[]) =>
	Prisma.sql`(cardinality(rp."ruleIds") > 0 AND rp."ruleIds" <@ ${[...fuzzyRuleIds]}::text[])`
// Bit i set when the run's vendor i (in `vendorIds`' order) matched the pair.
const vendorMask = (vendorIds: readonly string[]) => Prisma.sql`(
	SELECT coalesce(bit_or(1 << (v.i - 1)::int), 0)
	FROM unnest(${[...vendorIds]}::text[]) WITH ORDINALITY AS v(id, i)
	WHERE v.id = ANY(rp."matchedByExportIds")
)`

// Between the two records' search text on a pair (snapshotRunPairs): a
// character no search contains, so a match never spans both records.
const SEARCH_SEPARATOR = '\u0001'

// result-rows.ts `matchesCategory`.
function categorySql(category: ResultFilters['category'], context: PairContext): Prisma.Sql {
	const vendor = vendorSame(context.vendorId)
	const jev = jevSame(context.threshold)
	switch (category) {
		case undefined:
			return Prisma.sql`TRUE`
		case 'incomplete':
			return Prisma.sql`NOT ${judged}`
		case 'both_matched':
			return Prisma.sql`${judged} AND ${vendor} AND ${jev}`
		case 'vendor_only':
			return Prisma.sql`${judged} AND ${vendor} AND NOT ${jev}`
		case 'pairsight_only':
			return Prisma.sql`${judged} AND NOT ${vendor} AND ${jev}`
		case 'neither_matched':
			return Prisma.sql`${judged} AND NOT ${vendor} AND NOT ${jev}`
		case 'disagreements':
			return Prisma.sql`${judged} AND ${vendor} <> ${jev}`
	}
}

// result-rows.ts `matchesScore`.
function scoreSql(score: ResultFilters['score'], threshold: number): Prisma.Sql {
	if (score == null) return Prisma.sql`TRUE`
	switch (score) {
		case 'near':
			return Prisma.sql`${judged} AND ${near(threshold)}`
		case 'above':
			return Prisma.sql`${judged} AND ${jevSame(threshold)}`
		case 'below':
			return Prisma.sql`${judged} AND NOT ${jevSame(threshold)}`
	}
	const { from, to } = scoreRange(score)
	// The last range includes a perfect 1.
	return to === 1
		? Prisma.sql`${judged} AND rp.score >= ${from}::float8 AND (rp.score < 1 OR rp.score = 1)`
		: Prisma.sql`${judged} AND rp.score >= ${from}::float8 AND rp.score < ${to}::float8`
}

// result-rows.ts `matchesSource`.
function sourceSql(source: ResultFilters['source'], fuzzyRuleIds: readonly string[]): Prisma.Sql {
	switch (source) {
		case undefined:
			return Prisma.sql`TRUE`
		case 'rules':
			return Prisma.sql`cardinality(rp."ruleIds") > 0`
		case 'fuzzy':
			return fuzzyOnly(fuzzyRuleIds)
		case 'vendor':
			return Prisma.sql`cardinality(rp."ruleIds") = 0`
	}
}

// result-rows.ts `matchesStatus`.
function statusSql(status: ResultFilters['status']): Prisma.Sql {
	switch (status) {
		case undefined:
			return Prisma.sql`TRUE`
		case 'evaluated':
			return Prisma.sql`rp.status = 'succeeded'`
		case 'incomplete':
			return Prisma.sql`rp.status <> 'succeeded'`
		case 'pending':
			return Prisma.sql`rp.status IN ('pending', 'running')`
		case 'failed':
			return Prisma.sql`rp.status = 'failed'`
	}
}

// Either record's reference or name contains the search, ignoring case.
function searchSql(q: string | undefined): Prisma.Sql {
	const query = q?.toLowerCase()
	if (query == null || query === '') return Prisma.sql`TRUE`
	if (query.includes(SEARCH_SEPARATOR)) return Prisma.sql`FALSE`
	return Prisma.sql`strpos(rp."searchText", ${query}) > 0`
}

// result-rows.ts `applyFilters`, as a WHERE clause on run_pairs alone.
function whereSql(filters: ResultFilters, context: PairContext): Prisma.Sql {
	const lowConfidence =
		filters.lowConfidence == null
			? Prisma.sql`TRUE`
			: Prisma.sql`${judged} AND ${near(context.threshold)}`
	return Prisma.sql`WHERE rp."runId" = ${context.runId}::uuid
		AND ${categorySql(filters.category, context)}
		AND ${scoreSql(filters.score, context.threshold)}
		AND ${sourceSql(filters.source, context.fuzzyRuleIds)}
		AND ${lowConfidence}
		AND ${statusSql(filters.status)}
		AND ${searchSql(filters.q)}`
}

// result-rows.ts `applyFilters`' order, then the pair's id so equal keys
// still have one order and pages never overlap. The default puts
// disagreements first, then the surest, then the first record's reference.
function orderSql(sort: ResultFilters['sort'], context: PairContext): Prisma.Sql {
	if (sort === 'score-asc') return Prisma.sql`ORDER BY rp.score ASC NULLS LAST, rp.id`
	if (sort === 'score-desc') return Prisma.sql`ORDER BY rp.score DESC NULLS LAST, rp.id`
	const vendor = vendorSame(context.vendorId)
	const jev = jevSame(context.threshold)
	return Prisma.sql`ORDER BY
		CASE
			WHEN NOT ${judged} THEN 4
			WHEN NOT ${vendor} AND ${jev} THEN 0
			WHEN ${vendor} AND NOT ${jev} THEN 1
			WHEN ${vendor} THEN 2
			ELSE 3
		END,
		rp.score DESC NULLS LAST,
		rp."sortKey",
		rp.id`
}

type PairRowRecord = {
	id: string
	recordAId: string
	recordBId: string
	ruleIds: string[]
	matchedByExportIds: string[]
	status: AssessmentStatus
	score: number | null
	errorCode: string | null
	referenceA: string
	labelA: string | null
	referenceB: string
	labelB: string | null
}

// The returned rows, and only those, joined to their judgment and records:
// `page` is a handful of pairs from run_pairs, numbered in its order (`ord`).
function withRecords(page: Prisma.Sql): Prisma.Sql {
	return Prisma.sql`
		WITH page AS (${page})
		SELECT page.id, page."recordAId", page."recordBId", page."ruleIds",
			page."matchedByExportIds", page.status::text AS status, page.score,
			CASE WHEN page.status = 'failed' THEN a."errorCode" END AS "errorCode",
			ra.reference AS "referenceA", ra.label AS "labelA",
			rb.reference AS "referenceB", rb.label AS "labelB"
		FROM page
		JOIN assessments a ON a.id = page."assessmentId"
		JOIN source_records ra ON ra.id = page."recordAId"
		JOIN source_records rb ON rb.id = page."recordBId"
		ORDER BY page.ord`
}

// Rows in today's ResultRow shape, built by the same code as before.
function toResultRows(records: PairRowRecord[], context: PairContext): ResultRow[] {
	const summaries = new Map<string, RecordSummary>()
	for (const row of records) {
		summaries.set(row.recordAId, {
			id: row.recordAId,
			reference: row.referenceA,
			label: row.labelA ?? row.referenceA
		})
		summaries.set(row.recordBId, {
			id: row.recordBId,
			reference: row.referenceB,
			label: row.labelB ?? row.referenceB
		})
	}
	return buildRows({
		pairs: records.map((row) => ({
			id: row.id,
			recordAId: row.recordAId,
			recordBId: row.recordBId,
			ruleIds: row.ruleIds,
			matchedByExportIds: row.matchedByExportIds,
			assessment: { status: row.status, score: row.score, errorCode: row.errorCode }
		})),
		records: summaries,
		threshold: context.threshold,
		vendorId: context.vendorId,
		fuzzyRuleIds: new Set(context.fuzzyRuleIds)
	})
}

// The queries a Results request makes, built but not run, so the plan check
// (scripts/scale/check-results.mts) can read exactly what's sent.
export const requestSql = {
	count: (context: PairContext, filters: ResultFilters) =>
		Prisma.sql`SELECT count(*) AS count FROM run_pairs rp ${whereSql(filters, context)}`,
	page: (context: PairContext, filters: ResultFilters, page: number, size: number) =>
		withRecords(Prisma.sql`
			SELECT rp.*, row_number() OVER (${orderSql(filters.sort, context)}) AS ord
			FROM run_pairs rp ${whereSql(filters, context)}
			${orderSql(filters.sort, context)}
			LIMIT ${size} OFFSET ${(page - 1) * size}`),
	byIds: (context: PairContext, ids: readonly string[]) =>
		withRecords(Prisma.sql`
			SELECT rp.*, array_position(${[...ids]}::uuid[], rp.id) AS ord
			FROM run_pairs rp
			WHERE rp."runId" = ${context.runId}::uuid AND rp.id = ANY(${[...ids]}::uuid[])`),
	position: (context: PairContext, filters: ResultFilters, pairId: string) => Prisma.sql`
		SELECT * FROM (
			SELECT rp.id,
				row_number() OVER w AS position,
				count(*) OVER () AS total,
				lag(rp.id) OVER w AS "previousId",
				lead(rp.id) OVER w AS "nextId"
			FROM run_pairs rp ${whereSql(filters, context)}
			WINDOW w AS (${orderSql(filters.sort, context)})
		) list
		WHERE list.id = ${pairId}::uuid`
}

// How many pairs the filters keep.
export async function countPairs({
	context,
	filters
}: {
	context: PairContext
	filters: ResultFilters
}): Promise<number> {
	const [row] = await db.$queryRaw<Array<{ count: bigint }>>(requestSql.count(context, filters))
	return Number(row?.count ?? 0)
}

// One page of the filtered list, in its order.
export async function pairPage({
	context,
	filters,
	page,
	size
}: {
	context: PairContext
	filters: ResultFilters
	page: number
	size: number
}): Promise<ResultRow[]> {
	const records = await db.$queryRaw<PairRowRecord[]>(requestSql.page(context, filters, page, size))
	return toResultRows(records, context)
}

// Given pairs as rows, in the order asked for (the Overview's top
// disagreements).
export async function pairRowsByIds({
	context,
	ids
}: {
	context: PairContext
	ids: readonly string[]
}): Promise<ResultRow[]> {
	if (ids.length === 0) return []
	const records = await db.$queryRaw<PairRowRecord[]>(requestSql.byIds(context, ids))
	return toResultRows(records, context)
}

// Where a pair sits in the filtered list, and its neighbours, for the pair
// page's position and J/K. Null when the filters leave it out.
export async function pairPosition({
	context,
	filters,
	pairId
}: {
	context: PairContext
	filters: ResultFilters
	pairId: string
}): Promise<{
	position: number
	total: number
	previousId: string | null
	nextId: string | null
} | null> {
	const [row] = await db.$queryRaw<
		Array<{
			id: string
			position: bigint
			total: bigint
			previousId: string | null
			nextId: string | null
		}>
	>(requestSql.position(context, filters, pairId))
	if (row == null) return null
	return {
		position: Number(row.position),
		total: Number(row.total),
		previousId: row.previousId,
		nextId: row.nextId
	}
}

// Records (as record A) whose pairs are handled at a time when walking a
// whole run: a few thousand pairs, read through indexes.
const RECORDS_PER_PAGE = 1_000

// The dataset's record ids in natural order, a chunk at a time, through the
// (datasetId, sortKey) index.
async function* recordChunks(datasetId: string) {
	let after: string | undefined
	for (;;) {
		const records = await db.sourceRecord.findMany({
			where: {
				datasetId,
				...(after == null ? { sortKey: { not: null } } : { sortKey: { gt: after } })
			},
			orderBy: { sortKey: 'asc' },
			take: RECORDS_PER_PAGE,
			select: { id: true, sortKey: true }
		})
		const last = records.at(-1)
		if (last?.sortKey == null) return
		after = last.sortKey
		yield records.map((record) => record.id)
	}
}

// Copies onto each of the run's pairs what Results read (run_pairs.status,
// score, sortKey, searchText): the judgment as it is now, and the records'
// keys. Background work while the summary is built, a chunk of records at a
// time, so it never joins the whole run at once. Returns the Jev versions
// that judged the run.
export async function snapshotRunPairs({
	runId,
	datasetId
}: {
	runId: string
	datasetId: string
}): Promise<string[]> {
	const models = new Set<string>()
	for await (const recordAIds of recordChunks(datasetId)) {
		await db.$executeRaw`
			UPDATE run_pairs rp
			SET status = a.status, score = a.score,
				"sortKey" = least(ra."sortKey", rb."sortKey"),
				"searchText" = ra."searchText" || ${SEARCH_SEPARATOR} || rb."searchText"
			FROM assessments a, source_records ra, source_records rb
			WHERE rp."runId" = ${runId}::uuid AND rp."recordAId" = ANY(${recordAIds}::uuid[])
				AND a.id = rp."assessmentId" AND ra.id = rp."recordAId" AND rb.id = rp."recordBId"
				-- Only pairs whose copy is out of date: a rebuild after one
				-- re-check rewrites that pair, not the run.
				AND (rp.status IS DISTINCT FROM a.status OR rp.score IS DISTINCT FROM a.score
					OR rp."sortKey" IS NULL)`
		const rows = await db.$queryRaw<Array<{ model: string }>>`
			SELECT DISTINCT a."modelReported" AS model
			FROM run_pairs rp
			JOIN assessments a ON a.id = rp."assessmentId"
			WHERE rp."runId" = ${runId}::uuid AND rp."recordAId" = ANY(${recordAIds}::uuid[])
				AND a."modelReported" IS NOT NULL`
		for (const row of rows) models.add(row.model)
	}
	return [...models].sort()
}

// Every pair of the run with both records, a page at a time, in the
// findings file's order: the dataset's records in natural order through
// their index, then the pairs each chunk holds as record A. Flat memory and
// flat cost per page at any size; the findings download and the summary's
// field patterns walk the run this way.
export async function* runPairPages({ runId, datasetId }: { runId: string; datasetId: string }) {
	for await (const recordAIds of recordChunks(datasetId)) {
		const page = await findingsPage({ runId, recordAIds })
		if (page.length > 0) yield page
	}
}

// The run's count table (stats.ts): pairs grouped by everything an Overview
// number depends on, binned exactly as stats.ts `binPairs` does. A pair's
// vendor bitmask follows `vendorIds`' order.
export async function statsRows({
	runId,
	threshold,
	vendorIds,
	fuzzyRuleIds
}: {
	runId: string
	threshold: number
	vendorIds: readonly string[]
	fuzzyRuleIds: readonly string[]
}): Promise<StatsRow[]> {
	const rows = await db.$queryRaw<
		Array<{
			status: AssessmentStatus
			bin: number | null
			match: boolean
			near: boolean
			mask: number
			kind: RuleKind
			count: bigint
		}>
	>`
		WITH p AS (
			SELECT rp.status, rp.score, floor(rp.score * 100)::int AS b,
				${judged} AND ${jevSame(threshold)} AS match,
				${judged} AND ${near(threshold)} AS near,
				${vendorMask(vendorIds)} AS mask,
				CASE
					WHEN cardinality(rp."ruleIds") = 0 THEN 'none'
					WHEN ${fuzzyOnly(fuzzyRuleIds)} THEN 'fuzzy'
					ELSE 'other'
				END AS kind
			FROM run_pairs rp
			WHERE rp."runId" = ${runId}::uuid
		),
		-- stats.ts scoreBin: the floor, moved across an edge the product
		-- rounded over, so bin k is exactly the scores a k/100 cut-off keeps.
		binned AS (
			SELECT p.*,
				CASE WHEN p.score IS NULL THEN NULL ELSE greatest(0, least(100,
					CASE
						WHEN p.score >= (p.b + 1)::float8 / 100 THEN p.b + 1
						WHEN p.score < p.b::float8 / 100 THEN p.b - 1
						ELSE p.b
					END
				)) END AS bin
			FROM p
		)
		SELECT status::text AS status, bin, match, near, mask, kind, count(*) AS count
		FROM binned
		GROUP BY status, bin, match, near, mask, kind`
	return rows.map((row) => ({ ...row, count: Number(row.count) }))
}

// Pairs per rule that found them, for each vendor's sources table.
export async function sourceStats({
	runId,
	threshold,
	vendorIds
}: {
	runId: string
	threshold: number
	vendorIds: readonly string[]
}): Promise<SourceStat[]> {
	const rows = await db.$queryRaw<Array<Omit<SourceStat, 'count'> & { count: bigint }>>`
		SELECT r.rule_id AS "ruleId",
			${judged} AS judged,
			${judged} AND ${jevSame(threshold)} AS match,
			${vendorMask(vendorIds)} AS mask,
			count(*) AS count
		FROM run_pairs rp
		CROSS JOIN LATERAL (
			SELECT unnest(rp."ruleIds") AS rule_id
			UNION ALL
			SELECT NULL WHERE cardinality(rp."ruleIds") = 0
		) r
		WHERE rp."runId" = ${runId}::uuid
		GROUP BY 1, 2, 3, 4`
	return rows.map((row) => ({ ...row, count: Number(row.count) }))
}

// The few disagreements to start reviewing with, for one vendor
// (result-overview.ts `topDisagreements`): the duplicates it missed Jev is
// surest of, and its merges Jev is least sure of.
export async function topDisagreementIds({
	context,
	limit
}: {
	context: PairContext
	limit: number
}): Promise<{ missed: string[]; merges: string[] }> {
	const [missed, merges] = await Promise.all([
		db.$queryRaw<Array<{ id: string }>>`
			SELECT rp.id FROM run_pairs rp
			${whereSql({ category: 'pairsight_only' }, context)}
			ORDER BY rp.score DESC, rp.id LIMIT ${limit}`,
		db.$queryRaw<Array<{ id: string }>>`
			SELECT rp.id FROM run_pairs rp
			${whereSql({ category: 'vendor_only' }, context)}
			ORDER BY rp.score ASC, rp.id LIMIT ${limit}`
	])
	return { missed: missed.map((row) => row.id), merges: merges.map((row) => row.id) }
}

export type FindingsPage = Array<{
	recordAId: string
	recordBId: string
	ruleIds: string[]
	matchedByExportIds: string[]
	status: AssessmentStatus
	score: number | null
	errorCode: string | null
	modelReported: string | null
	completedAt: Date | null
	referenceA: string
	valuesA: Prisma.JsonValue
	referenceB: string
	valuesB: Prisma.JsonValue
}>

// The run's pairs whose record A is one of `recordAIds`, with both records,
// ordered by record A's then record B's natural reference: findings.ts walks
// the dataset's records in that order a chunk at a time (an index read), so
// the millionth row costs what the first does.
export async function findingsPage({
	runId,
	recordAIds
}: {
	runId: string
	recordAIds: readonly string[]
}): Promise<FindingsPage> {
	if (recordAIds.length === 0) return []
	return db.$queryRaw<FindingsPage>`
		SELECT rp."recordAId", rp."recordBId", rp."ruleIds", rp."matchedByExportIds",
			a.status::text AS status, a.score, a."errorCode", a."modelReported", a."completedAt",
			ra.reference AS "referenceA", ra.values AS "valuesA",
			rb.reference AS "referenceB", rb.values AS "valuesB"
		FROM run_pairs rp
		JOIN assessments a ON a.id = rp."assessmentId"
		JOIN source_records ra ON ra.id = rp."recordAId"
		JOIN source_records rb ON rb.id = rp."recordBId"
		WHERE rp."runId" = ${runId}::uuid AND rp."recordAId" = ANY(${[...recordAIds]}::uuid[])
		ORDER BY ra."sortKey", rb."sortKey"`
}
