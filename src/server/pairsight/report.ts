import 'server-only'
import { possiblePairs } from '@/lib/pairsight/metrics'
import { db } from '@/server/db/client'
import { parseBlockingRules, parseColumnRoles, parseRecordValues, parseVendorStats } from './json'
import { buildReport, reportExample } from './report-summary'
import { pairRowsByIds } from './results-query'
import { fuzzyRuleIdsOf, readRunSummary, runVendors } from './run-summary'
import { getRunProgress, getVisibleRun, runNotFinished } from './runs'
import { countReusedJudgments } from './run-centre'
import type { EvaluationScope } from './scope'
import type { FieldRole } from './fields'
import type { RunSummary } from './result-overview'
import type { ResultRow } from './result-rows'

// Everything the summary report shows for one run: the results (built by
// report-summary.ts) and the setup that gives them context. Every query
// after the run itself starts together.

export async function reportData({ scope, runId }: { scope: EvaluationScope; runId: string }) {
	const run = await getVisibleRun({ scope, runId })
	if (run.status !== 'completed') throw runNotFinished()
	const [dataset, vendors, summary, exports, progress, reused, reported, preparedBy] =
		await Promise.all([
			db.sourceDataset.findUniqueOrThrow({
				where: { id: run.datasetId },
				select: { fileName: true, rowCount: true, referenceColumn: true, columnRoles: true }
			}),
			runVendors(run.exportIds),
			readRunSummary(run),
			db.vendorExport.findMany({
				where: { id: { in: run.exportIds } },
				select: {
					id: true,
					fileName: true,
					format: true,
					pairCount: true,
					stats: true,
					confirmedCompleteAt: true
				}
			}),
			getRunProgress(run.id),
			countReusedJudgments(run),
			db.assessment.findFirst({
				where: { runPairs: { some: { runId: run.id } }, modelReported: { not: null } },
				select: { modelReported: true }
			}),
			// The owner's name; null for the sandbox, which no one owns.
			db.evaluation
				.findUniqueOrThrow({ where: { id: run.evaluationId }, select: { ownerId: true } })
				.then(({ ownerId }) =>
					ownerId == null
						? null
						: db.user
								.findUnique({ where: { id: ownerId }, select: { name: true } })
								.then((user) => user?.name ?? '')
				)
		])
	const exportById = new Map(exports.map((vendorExport) => [vendorExport.id, vendorExport]))
	const report = buildReport({
		summary,
		vendors,
		examples: await reportExamples({
			runId,
			threshold: run.threshold,
			fuzzyRuleIds: fuzzyRuleIdsOf(run.blockingRules),
			summary,
			columnRoles: parseColumnRoles(dataset.columnRoles),
			country: run.countryCode
		})
	})

	return {
		evaluationName: run.evaluation.name,
		runNumber: run.number,
		preparedBy,
		threshold: run.threshold,
		createdAt: run.createdAt,
		completedAt: run.completedAt,
		model: reported?.modelReported ?? run.jevModel,
		identitySame: run.identitySame,
		identityDifferent: run.identityDifferent,
		countryCode: run.countryCode,
		jevFields: run.jevFields,
		rules: parseBlockingRules(run.blockingRules),
		dataset: {
			fileName: dataset.fileName,
			rowCount: dataset.rowCount,
			referenceColumn: dataset.referenceColumn
		},
		vendorFiles: vendors.flatMap((vendor) => {
			const file = exportById.get(vendor.id)
			return file == null
				? []
				: [{ ...file, name: vendor.name, stats: parseVendorStats(file.stats) }]
		}),
		progress,
		reused,
		recordCount: summary.recordCount,
		// Possible pairs no rule or vendor brought up: the report's blind spot.
		notCompared: Math.max(0, possiblePairs(summary.recordCount) - report.pairs.total),
		report
	}
}

// Each vendor's top disagreements from the summary, read with their records
// so their fields can be compared: a few pairs, whatever the run's size.
async function reportExamples({
	runId,
	threshold,
	fuzzyRuleIds,
	summary,
	columnRoles,
	country
}: {
	runId: string
	threshold: number
	fuzzyRuleIds: string[]
	summary: RunSummary
	columnRoles: Record<string, FieldRole>
	country: string
}) {
	const entries = await Promise.all(
		summary.vendorIds.map(async (vendorId) => {
			const top = summary.top[vendorId] ?? { missed: [], merges: [] }
			const context = { runId, threshold, vendorId, fuzzyRuleIds }
			const [misses, merges] = await Promise.all([
				pairRowsByIds({ context, ids: top.missed }),
				pairRowsByIds({ context, ids: top.merges })
			])
			return { vendorId, misses, merges }
		})
	)
	const ids = entries.flatMap(({ misses, merges }) =>
		[...misses, ...merges].flatMap((row) => [row.recordA.id, row.recordB.id])
	)
	const records = await db.sourceRecord.findMany({
		where: { id: { in: [...new Set(ids)] } },
		select: { id: true, values: true }
	})
	const values = new Map(
		records.map((record) => [record.id, { values: parseRecordValues(record.values) }])
	)
	const example = (row: ResultRow) => reportExample({ row, records: values, columnRoles, country })
	return Object.fromEntries(
		entries.map(({ vendorId, misses, merges }) => [
			vendorId,
			{ misses: misses.flatMap(example), merges: merges.flatMap(example) }
		])
	)
}

export type ReportData = Awaited<ReturnType<typeof reportData>>
