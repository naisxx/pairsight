import 'server-only'
import { possiblePairs } from '@/lib/pairsight/metrics'
import { db } from '@/server/db/client'
import { parseBlockingRules, parseVendorStats } from './json'
import { buildReport } from './report-summary'
import { loadRunView } from './results'
import { getRunProgress, runNotFinished } from './runs'
import { countReusedJudgments } from './run-centre'
import type { EvaluationScope } from './scope'

// Everything the summary report shows for one run: the results (built by
// report-summary.ts) and the setup that gives them context. Every query
// after the run itself starts together.

export async function reportData({ scope, runId }: { scope: EvaluationScope; runId: string }) {
	const view = await loadRunView({ scope, runId })
	const { run } = view
	if (run.status !== 'completed') throw runNotFinished()
	const [dataset, exports, progress, reused, reported, preparedBy] = await Promise.all([
		db.sourceDataset.findUniqueOrThrow({
			where: { id: run.datasetId },
			select: { fileName: true, rowCount: true, referenceColumn: true }
		}),
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
		threshold: run.threshold,
		country: run.countryCode,
		columnRoles: view.columnRoles,
		records: view.recordsById,
		vendors: view.vendors,
		pairs: view.pairs,
		fuzzyRuleIds: view.fuzzyRuleIds
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
		dataset,
		vendorFiles: view.vendors.flatMap((vendor) => {
			const file = exportById.get(vendor.id)
			return file == null
				? []
				: [{ ...file, name: vendor.name, stats: parseVendorStats(file.stats) }]
		}),
		progress,
		reused,
		recordCount: view.recordsById.size,
		// Possible pairs no rule or vendor brought up: the report's blind spot.
		notCompared: Math.max(0, possiblePairs(view.recordsById.size) - report.pairs.total),
		report
	}
}

export type ReportData = Awaited<ReturnType<typeof reportData>>
