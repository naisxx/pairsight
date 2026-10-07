import 'server-only'
import { statsForVendor, statsMetrics } from '@/lib/pairsight/stats'
import { db } from '@/server/db/client'
import { categorize } from './decisions'
import { parseColumnRoles, parseRecordValues } from './json'
import { buildOverview } from './result-overview'
import { buildRows, byReference, PAGE_SIZE, pickVendorId, type ResultFilters } from './result-rows'
import {
	countPairs,
	pairPage,
	pairPosition,
	pairRowsByIds,
	type PairContext
} from './results-query'
import { readRunSummary, runVendors } from './run-summary'
import { getVisibleRun } from './runs'
import type { EvaluationScope } from './scope'

export {
	parseResultFilters,
	type CategoryCounts,
	type ResultCategory,
	type ResultFilters,
	type ResultRow
} from './result-rows'

// Read models for the Results and Pair detail screens.

// The run's finished Results: the Overview from its summary
// (run-summary.ts), Detailed analysis a page at a time from the database
// (results-query.ts). Nothing here loads the whole run.
async function resultsContext({ scope, runId }: { scope: EvaluationScope; runId: string }) {
	const run = await getVisibleRun({ scope, runId })
	const [vendors, summary] = await Promise.all([
		runVendors(run.exportIds),
		// Builds it, and the pairs every page reads, if it isn't current.
		readRunSummary(run)
	])
	return { run, vendors, summary }
}

export async function getRunResults({
	scope,
	runId,
	filters
}: {
	scope: EvaluationScope
	runId: string
	filters: ResultFilters
}) {
	const { run, vendors, summary } = await resultsContext({ scope, runId })
	const vendorId = pickVendorId(vendors, filters.vendor)
	const context: PairContext = { runId, threshold: run.threshold, vendorId }
	const vendorIndex = vendorId == null ? -1 : summary.vendorIds.indexOf(vendorId)
	const isDetailed = filters.tab === 'detailed'
	const top = vendorId == null ? undefined : summary.top[vendorId]
	const pageSize = filters.size ?? PAGE_SIZE
	const requestedPage = filters.page ?? 1
	const [matching, firstTry, missed, merges] = await Promise.all([
		countPairs({ context, filters }),
		isDetailed ? pairPage({ context, filters, page: requestedPage, size: pageSize }) : [],
		isDetailed ? [] : pairRowsByIds({ context, ids: top?.missed ?? [] }),
		isDetailed ? [] : pairRowsByIds({ context, ids: top?.merges ?? [] })
	])
	const pageCount = Math.max(1, Math.ceil(matching / pageSize))
	const page = Math.min(requestedPage, pageCount)
	// Past the last page (the list shrank): show the last one.
	const rows =
		isDetailed && page !== requestedPage
			? await pairPage({ context, filters, page, size: pageSize })
			: firstTry
	const counts = statsMetrics(summary.rows, vendorIndex).counts
	const overview = buildOverview({ summary, vendors, vendorId, top: { missed, merges } })
	return {
		run,
		vendors,
		vendorId,
		counts,
		evaluated: overview.coverage.total - counts.incomplete,
		coverage: {
			total: overview.coverage.total,
			suggested: overview.coverage.suggested,
			addedByVendor: overview.coverage.addedByVendor
		},
		models: summary.models,
		overview,
		// This vendor's counts, so the threshold control can preview another
		// threshold without a round trip; small whatever the run's size.
		stats: statsForVendor(summary.rows, vendorIndex),
		// Each vendor's categories side by side; only worth showing with two or more.
		vendorCounts:
			vendors.length < 2
				? []
				: overview.byVendor.map((vendor) => ({
						id: vendor.id,
						name: vendor.name,
						counts: vendor.metrics.counts
					})),
		rows,
		pageSize,
		matching,
		page,
		pageCount
	}
}

export async function getPairDetail({
	scope,
	runId,
	pairId,
	filters
}: {
	scope: EvaluationScope
	runId: string
	pairId: string
	filters: ResultFilters
}) {
	const run = await getVisibleRun({ scope, runId })
	const [vendors, dataset, pair] = await Promise.all([
		runVendors(run.exportIds),
		db.sourceDataset.findUniqueOrThrow({
			where: { id: run.datasetId },
			select: { columnRoles: true }
		}),
		db.runPair.findFirst({
			where: { id: pairId, runId },
			select: {
				id: true,
				recordAId: true,
				recordBId: true,
				isSuggested: true,
				matchedByExportIds: true,
				assessment: {
					select: {
						status: true,
						score: true,
						errorCode: true,
						modelReported: true,
						completedAt: true
					}
				}
			}
		}),
		// Its position is read from the run's pairs as of its summary.
		readRunSummary(run)
	])
	if (pair == null) return null
	const records = await db.sourceRecord.findMany({
		where: { id: { in: [pair.recordAId, pair.recordBId] } },
		select: { id: true, reference: true, values: true, label: true }
	})
	const recordsById = new Map(
		records.map((record) => [
			record.id,
			{
				id: record.id,
				reference: record.reference,
				values: parseRecordValues(record.values),
				label: record.label ?? record.reference
			}
		])
	)
	const first = recordsById.get(pair.recordAId)
	const second = recordsById.get(pair.recordBId)
	if (first == null || second == null) return null

	const vendorId = pickVendorId(vendors, filters.vendor)
	const context: PairContext = { runId, threshold: run.threshold, vendorId }
	const [row] = buildRows({
		pairs: [pair],
		records: recordsById,
		threshold: run.threshold,
		vendorId
	})
	if (row == null) return null
	// Its place in the filtered list it was opened from; if the filters no
	// longer include this pair, step through the whole run instead.
	const inFiltered = await pairPosition({ context, filters, pairId })
	const position = inFiltered ?? (await pairPosition({ context, filters: {}, pairId }))
	const [recordA, recordB] = byReference(first, second)
	return {
		run,
		columnRoles: parseColumnRoles(dataset.columnRoles),
		assessment: pair.assessment,
		isSuggested: pair.isSuggested,
		row,
		recordA,
		recordB,
		vendors: vendors.map((vendor) => {
			const isMatch = pair.matchedByExportIds.includes(vendor.id)
			return {
				...vendor,
				isMatch,
				category: categorize({
					isVendorMatch: isMatch,
					status: pair.assessment.status,
					score: pair.assessment.score,
					threshold: run.threshold
				})
			}
		}),
		vendorId,
		position: position?.position ?? null,
		listSize: position?.total ?? 0,
		isInFiltered: inFiltered != null,
		previousId: position?.previousId ?? null,
		nextId: position?.nextId ?? null
	}
}
