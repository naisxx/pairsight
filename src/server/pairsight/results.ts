import 'server-only'
import { db } from '@/server/db/client'
import { categorize } from './decisions'
import {
	applyFilters,
	buildRows,
	byReference,
	countCategories,
	PAGE_SIZE,
	pickVendorId,
	recordLabel,
	type ResultFilters
} from './result-rows'
import { buildOverview } from './result-overview'
import { getVisibleRun } from './runs'
import type { EvaluationScope } from './scope'
import { parseColumnRoles, parseRecordValues } from './json'

export {
	parseResultFilters,
	type CategoryCounts,
	type ResultCategory,
	type ResultFilters,
	type ResultRow
} from './result-rows'

// Database-backed read models for the Results and Pair detail screens. A run
// holds at most LIMITS.maxPairsPerRun pairs, so loading it whole and filtering
// in memory (src/server/pairsight/result-rows.ts) is cheap and keeps one
// definition of "the current list" for both screens.

// Everything a run's results are built from, loaded once: shared by Results and the
// findings export (findings.ts).
export async function loadRunView({ scope, runId }: { scope: EvaluationScope; runId: string }) {
	const run = await getVisibleRun({ scope, runId })
	const [dataset, records, vendors, pairs] = await Promise.all([
		db.sourceDataset.findUniqueOrThrow({
			where: { id: run.datasetId },
			select: { columnRoles: true }
		}),
		db.sourceRecord.findMany({
			where: { datasetId: run.datasetId },
			select: { id: true, reference: true, values: true }
		}),
		db.vendorExport.findMany({
			where: { id: { in: run.exportIds } },
			orderBy: { createdAt: 'asc' },
			select: { id: true, name: true }
		}),
		db.runPair.findMany({
			where: { runId },
			select: {
				id: true,
				recordAId: true,
				recordBId: true,
				ruleIds: true,
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
		})
	])
	const columnRoles = parseColumnRoles(dataset.columnRoles)
	const recordsById = new Map(
		records.map((record) => {
			const values = parseRecordValues(record.values)
			const label = recordLabel({ values, columnRoles, reference: record.reference })
			return [record.id, { id: record.id, reference: record.reference, values, label }]
		})
	)
	return { run, columnRoles, recordsById, vendors, pairs }
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
	const view = await loadRunView({ scope, runId })
	const vendorId = pickVendorId(view.vendors, filters.vendor)
	const rows = buildRows({
		pairs: view.pairs,
		records: view.recordsById,
		threshold: view.run.threshold,
		vendorId
	})
	const counts = countCategories(rows)
	const filtered = applyFilters(rows, filters)
	const pageSize = filters.size ?? PAGE_SIZE
	const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
	const page = Math.min(filters.page ?? 1, pageCount)
	return {
		run: view.run,
		vendors: view.vendors,
		vendorId,
		counts,
		evaluated: rows.length - counts.incomplete,
		coverage: {
			total: rows.length,
			fromRules: rows.filter((row) => row.ruleIds.length > 0).length,
			addedByVendor: rows.filter((row) => row.ruleIds.length === 0).length
		},
		models: [...new Set(view.pairs.flatMap((pair) => pair.assessment.modelReported ?? []))],
		overview: buildOverview({
			pairs: view.pairs,
			rows,
			vendors: view.vendors,
			vendorId,
			threshold: view.run.threshold,
			recordCount: view.recordsById.size,
			records: view.recordsById,
			columnRoles: view.columnRoles,
			country: view.run.countryCode
		}),
		// Every pair's status, score and this vendor's decision, so the threshold
		// control can preview a new threshold without a round trip.
		metricPairs: rows.map((row) => ({
			status: row.status,
			score: row.score,
			isVendorMatch: row.isVendorMatch
		})),
		// Each vendor's categories side by side; only worth showing with two or more.
		vendorCounts:
			view.vendors.length < 2
				? []
				: view.vendors.map((vendor) => ({
						id: vendor.id,
						name: vendor.name,
						counts:
							vendor.id === vendorId
								? counts
								: countCategories(
										buildRows({
											pairs: view.pairs,
											records: view.recordsById,
											threshold: view.run.threshold,
											vendorId: vendor.id
										})
									)
					})),
		rows: filtered.slice((page - 1) * pageSize, page * pageSize),
		pageSize,
		matching: filtered.length,
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
	const view = await loadRunView({ scope, runId })
	const pair = view.pairs.find((candidate) => candidate.id === pairId)
	const first = pair == null ? undefined : view.recordsById.get(pair.recordAId)
	const second = pair == null ? undefined : view.recordsById.get(pair.recordBId)
	if (pair == null || first == null || second == null) return null

	const vendorId = pickVendorId(view.vendors, filters.vendor)
	const rows = buildRows({
		pairs: view.pairs,
		records: view.recordsById,
		threshold: view.run.threshold,
		vendorId
	})
	const row = rows.find((candidate) => candidate.id === pairId)
	if (row == null) return null
	// The filtered list it was opened from; if the filters no longer include
	// this pair, step through the whole run instead.
	const filtered = applyFilters(rows, filters)
	const isInFiltered = filtered.some((candidate) => candidate.id === pairId)
	const list = isInFiltered ? filtered : applyFilters(rows, {})
	const position = list.findIndex((candidate) => candidate.id === pairId)
	const [recordA, recordB] = byReference(first, second)
	return {
		run: view.run,
		columnRoles: view.columnRoles,
		assessment: pair.assessment,
		ruleIds: pair.ruleIds,
		row,
		recordA,
		recordB,
		vendors: view.vendors.map((vendor) => {
			const isMatch = pair.matchedByExportIds.includes(vendor.id)
			return {
				...vendor,
				isMatch,
				category: categorize({
					isVendorMatch: isMatch,
					status: pair.assessment.status,
					score: pair.assessment.score,
					threshold: view.run.threshold
				})
			}
		}),
		vendorId,
		position: position === -1 ? null : position + 1,
		listSize: list.length,
		isInFiltered,
		previousId: position > 0 ? (list[position - 1]?.id ?? null) : null,
		nextId: position !== -1 ? (list[position + 1]?.id ?? null) : null
	}
}
