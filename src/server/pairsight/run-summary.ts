import 'server-only'
import { db, Prisma } from '@/server/db/client'
import type { Category } from '@/lib/pairsight/decisions'
import type { EntityType } from '@/lib/pairsight/entity-types'
import { log } from '@/server/lib/logger'
import { recountRun } from './runs'
import { compareFields } from './compare'
import { parseColumnRoles, parseRecordValues } from './json'
import { ensureRecordKeys } from './record-keys'
import {
	finishFieldPatterns,
	RUN_SUMMARY_VERSION,
	runSummarySchema,
	TOP_DISAGREEMENTS,
	tallyPair,
	type PatternTallies,
	type RunSummary
} from './result-overview'
import {
	runPairPages,
	snapshotRunPairs,
	sourceStats,
	statsRows,
	topDisagreementIds
} from './results-query'

// A run's summary (runs.summary): the Overview's exact counts and patterns
// over every pair, worked out once in the database so Results never load the
// run. Building it also copies each pair's judgment onto run_pairs, which is
// all a Results page reads, so a summary and the pages always agree. Built when the run finishes (run-engine.ts `finishIfDone`), and on
// first read for runs finished before summaries existed. Judgments are
// shared between runs of the same records and settings, so a pair judged
// again changes every finished run that holds it: those summaries are
// cleared and rebuilt (`refreshRunSummaries`).

type SummaryRun = {
	id: string
	datasetId: string
	entityType: EntityType
	threshold: number
	exportIds: string[]
	countryCode: string
}

export const SUMMARY_RUN_SELECT = {
	id: true,
	datasetId: true,
	entityType: true,
	threshold: true,
	exportIds: true,
	countryCode: true
} as const

// The run's vendors in the order every Results view lists them: oldest first.
export async function runVendors(exportIds: string[]) {
	return db.vendorExport.findMany({
		where: { id: { in: exportIds } },
		orderBy: { createdAt: 'asc' },
		select: { id: true, name: true }
	})
}

// Field patterns for every vendor, walking the run's judged pairs a page at
// a time (memory stays flat whatever the run's size): each pair's fields are
// compared once, then counted under each vendor's category for it.
async function patternsFor({
	run,
	vendorIds
}: {
	run: SummaryRun
	vendorIds: string[]
}): Promise<RunSummary['patterns']> {
	const dataset = await db.sourceDataset.findUniqueOrThrow({
		where: { id: run.datasetId },
		select: { columnRoles: true }
	})
	const columnRoles = parseColumnRoles(dataset.columnRoles)
	type Tally = { counts: Partial<Record<Category, number>>; tallies: PatternTallies }
	const perVendor = vendorIds.map((): Tally => ({ counts: {}, tallies: new Map() }))
	const pages = runPairPages({ runId: run.id, datasetId: run.datasetId })[Symbol.asyncIterator]()
	let following = pages.next()
	for (;;) {
		const page = await following
		if (page.done === true) break
		// The next page is read while this one is compared.
		following = pages.next()
		const pairs = page.value.filter((pair) => pair.status === 'succeeded' && pair.score != null)
		for (const pair of pairs) {
			const isMatch = (pair.score ?? 0) >= run.threshold
			const fields = compareFields({
				valuesA: parseRecordValues(pair.valuesA),
				valuesB: parseRecordValues(pair.valuesB),
				columnRoles,
				country: run.countryCode
			}).fields
			vendorIds.forEach((vendorId, index) => {
				const tally = perVendor[index]
				if (tally == null) return
				const isVendorMatch = pair.matchedByExportIds.includes(vendorId)
				const category: Category = isVendorMatch
					? isMatch
						? 'both_matched'
						: 'vendor_only'
					: isMatch
						? 'pairsight_only'
						: 'neither_matched'
				tally.counts[category] = (tally.counts[category] ?? 0) + 1
				tallyPair(tally.tallies, category, fields)
			})
		}
	}
	return Object.fromEntries(
		vendorIds.map((vendorId, index) => {
			const tally = perVendor[index] ?? { counts: {}, tallies: new Map() }
			return [vendorId, finishFieldPatterns(tally.counts, tally.tallies)]
		})
	)
}

export async function buildRunSummary(run: SummaryRun): Promise<RunSummary> {
	const started = Date.now()
	// The pairs are walked in their records' order (results-query.ts).
	await ensureRecordKeys({ datasetId: run.datasetId, entityType: run.entityType })
	// What every count below, and every Results page after, reads: the run's
	// pairs as their judgments stand now.
	const models = await snapshotRunPairs({ runId: run.id, datasetId: run.datasetId })
	const vendorIds = (await runVendors(run.exportIds)).map((vendor) => vendor.id)
	const query = { runId: run.id, threshold: run.threshold, vendorIds }
	const [rows, sources, recordCount, patterns, tops] = await Promise.all([
		statsRows(query),
		sourceStats(query),
		db.sourceRecord.count({ where: { datasetId: run.datasetId } }),
		patternsFor({ run, vendorIds }),
		Promise.all(
			vendorIds.map((vendorId) =>
				topDisagreementIds({
					context: { runId: run.id, threshold: run.threshold, vendorId },
					limit: TOP_DISAGREEMENTS
				})
			)
		)
	])
	const summary: RunSummary = {
		threshold: run.threshold,
		vendorIds,
		rows,
		sources,
		patterns,
		top: Object.fromEntries(
			vendorIds.map((vendorId, index) => [vendorId, tops[index] ?? { missed: [], merges: [] }])
		),
		models,
		recordCount
	}
	log.info('pairsight run summary built', {
		runId: run.id,
		rows: rows.length,
		ms: Date.now() - started
	})
	return summary
}

// The summary as stored on the run.
export function summaryColumns(summary: RunSummary) {
	return { summary, summaryVersion: RUN_SUMMARY_VERSION }
}

// The run's summary: the stored one when it's current, otherwise built now
// and stored (runs finished before summaries, or cleared by a re-check).
// Only for finished runs: an unfinished one shows progress, not numbers.
export async function readRunSummary(
	run: SummaryRun & { summary: Prisma.JsonValue | null; summaryVersion: number | null }
): Promise<RunSummary> {
	if (run.summary != null && run.summaryVersion === RUN_SUMMARY_VERSION) {
		const parsed = runSummarySchema.safeParse(run.summary)
		if (parsed.success && parsed.data.threshold === run.threshold) return parsed.data
	}
	const summary = await buildRunSummary(run)
	await db.run.update({ where: { id: run.id }, data: summaryColumns(summary) })
	return summary
}

// Clears the summaries of the finished runs that share these judgments, so
// none shows numbers from before a pair was judged again.
export async function clearRunSummaries({
	datasetId,
	judgmentKey,
	exceptRunId
}: {
	datasetId: string
	judgmentKey: string
	exceptRunId?: string
}) {
	await db.run.updateMany({
		where: {
			datasetId,
			judgmentKey,
			status: 'completed',
			summary: { not: Prisma.DbNull },
			...(exceptRunId == null ? {} : { id: { not: exceptRunId } })
		},
		data: { summary: Prisma.DbNull, summaryVersion: null }
	})
}

// Rebuilds the cleared summaries of finished runs sharing these judgments.
// Background work: the run worker after a run finishes, or after a pair
// page's re-check has answered. A summary a read already rebuilt is left.
export async function refreshRunSummaries({
	datasetId,
	judgmentKey
}: {
	datasetId: string
	judgmentKey: string
}) {
	const runs = await db.run.findMany({
		where: { datasetId, judgmentKey, status: 'completed', summary: { equals: Prisma.DbNull } },
		select: SUMMARY_RUN_SELECT
	})
	for (const run of runs) {
		const summary = await buildRunSummary(run)
		await db.run.updateMany({
			where: { id: run.id, status: 'completed', summary: { equals: Prisma.DbNull } },
			data: summaryColumns(summary)
		})
		// Its progress counts shift with the same judgments.
		await recountRun(run.id)
	}
}
