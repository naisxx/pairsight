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
import { getOwnedRun } from './runs'
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

async function loadRunView({ ownerId, runId }: { ownerId: string; runId: string }) {
	const run = await getOwnedRun({ ownerId, runId })
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
	ownerId,
	runId,
	filters
}: {
	ownerId: string
	runId: string
	filters: ResultFilters
}) {
	const view = await loadRunView({ ownerId, runId })
	const vendorId = pickVendorId(view.vendors, filters.vendor)
	const rows = buildRows({
		pairs: view.pairs,
		records: view.recordsById,
		threshold: view.run.threshold,
		vendorId
	})
	const counts = countCategories(rows)
	const filtered = applyFilters(rows, filters)
	const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
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
		rows: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
		matching: filtered.length,
		page,
		pageCount
	}
}

export async function getPairDetail({
	ownerId,
	runId,
	pairId,
	filters
}: {
	ownerId: string
	runId: string
	pairId: string
	filters: ResultFilters
}) {
	const view = await loadRunView({ ownerId, runId })
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
	const list = applyFilters(rows, filters)
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
		previousId: position > 0 ? (list[position - 1]?.id ?? null) : null,
		nextId: position !== -1 ? (list[position + 1]?.id ?? null) : null
	}
}
