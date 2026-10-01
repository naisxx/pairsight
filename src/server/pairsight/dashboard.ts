import 'server-only'
import { db } from '@/server/db/client'
import { vendorMetrics, type VendorMetrics } from '@/lib/pairsight/metrics'
import {
	activeStage,
	evaluationStatus,
	stageHref,
	stageStates,
	type EvaluationStatus,
	type StageInput,
	type StageKey,
	type StageState
} from '@/lib/pairsight/stages'

// The Evaluations dashboard: every live evaluation with where it is in its
// pipeline, the headline counts, and the latest finished run's metrics per
// vendor. One query for the list (relation counts ride along), then one run
// summary.

export type DashboardRow = {
	id: string
	name: string
	createdAt: Date
	updatedAt: Date
	status: EvaluationStatus
	stages: Array<{ key: StageKey; state: StageState }>
	// Where to pick up, and its page; null once every stage is done.
	next: { key: StageKey; href: string } | null
	recordCount: number | null
	vendorCount: number
	lastRun: { id: string; number: number; createdAt: Date } | null
}

export type LatestResults = {
	evaluationId: string
	evaluationName: string
	run: { id: string; number: number; completedAt: Date | null; threshold: number }
	vendors: Array<{ id: string; name: string; metrics: VendorMetrics }>
}

export type Dashboard = {
	rows: DashboardRow[]
	stats: { evaluations: number; withResults: number; inSetup: number; pairsAssessed: number }
	latest: LatestResults | null
}

export async function getDashboard(ownerId: string): Promise<Dashboard> {
	const evaluations = await db.evaluation.findMany({
		where: { ownerId, kind: 'live' },
		orderBy: { updatedAt: 'desc' },
		select: {
			id: true,
			name: true,
			createdAt: true,
			updatedAt: true,
			// The current dataset is the newest; its vendor exports are the vendors.
			datasets: {
				orderBy: { createdAt: 'desc' },
				take: 1,
				select: {
					rowCount: true,
					_count: { select: { vendorExports: true, vendorDrafts: true } }
				}
			},
			runs: {
				orderBy: { number: 'desc' },
				take: 1,
				select: {
					id: true,
					number: true,
					status: true,
					createdAt: true,
					completedAt: true,
					_count: { select: { pairs: { where: { assessment: { status: 'succeeded' } } } } }
				}
			}
		}
	})

	const rows = evaluations.map((evaluation): DashboardRow => {
		const dataset = evaluation.datasets[0]
		const run = evaluation.runs[0]
		const vendorCount = dataset?._count.vendorExports ?? 0
		const input: StageInput = {
			hasRecords: dataset != null,
			hasVendors: vendorCount > 0,
			hasUnfinishedVendors: (dataset?._count.vendorDrafts ?? 0) > 0,
			latestRun: run == null ? null : { id: run.id, status: run.status }
		}
		const stages = stageStates(input)
		const nextKey = activeStage(stages)
		return {
			id: evaluation.id,
			name: evaluation.name,
			createdAt: evaluation.createdAt,
			updatedAt: evaluation.updatedAt,
			status: evaluationStatus(input),
			stages: stages.map(({ key, state }) => ({ key, state })),
			next:
				nextKey == null
					? null
					: { key: nextKey, href: stageHref(evaluation.id, nextKey, run?.id ?? null) },
			recordCount: dataset?.rowCount ?? null,
			vendorCount,
			lastRun: run == null ? null : { id: run.id, number: run.number, createdAt: run.createdAt }
		}
	})

	const finished = evaluations
		.flatMap((evaluation) => {
			const run = evaluation.runs[0]
			return run?.status === 'completed' ? [{ evaluation, run }] : []
		})
		.sort((a, b) => (b.run.completedAt?.getTime() ?? 0) - (a.run.completedAt?.getTime() ?? 0))
	const newest = finished[0]

	return {
		rows,
		stats: {
			evaluations: rows.length,
			withResults: finished.length,
			inSetup: rows.length - finished.length,
			pairsAssessed: evaluations.reduce((sum, item) => sum + (item.runs[0]?._count.pairs ?? 0), 0)
		},
		latest:
			newest == null
				? null
				: await latestResults({
						evaluationId: newest.evaluation.id,
						evaluationName: newest.evaluation.name,
						runId: newest.run.id
					})
	}
}

// A finished run's metrics per vendor: only statuses, scores and vendor
// decisions, none of the records the Results screen loads.
async function latestResults({
	evaluationId,
	evaluationName,
	runId
}: {
	evaluationId: string
	evaluationName: string
	runId: string
}): Promise<LatestResults> {
	const run = await db.run.findUniqueOrThrow({
		where: { id: runId },
		select: { id: true, number: true, completedAt: true, threshold: true, exportIds: true }
	})
	const [vendors, pairs] = await Promise.all([
		db.vendorExport.findMany({
			where: { id: { in: run.exportIds } },
			orderBy: { createdAt: 'asc' },
			select: { id: true, name: true }
		}),
		db.runPair.findMany({
			where: { runId },
			select: { matchedByExportIds: true, assessment: { select: { status: true, score: true } } }
		})
	])
	return {
		evaluationId,
		evaluationName,
		run: { id: run.id, number: run.number, completedAt: run.completedAt, threshold: run.threshold },
		vendors: vendors.map((vendor) => ({
			id: vendor.id,
			name: vendor.name,
			metrics: vendorMetrics(
				pairs.map((pair) => ({
					status: pair.assessment.status,
					score: pair.assessment.score,
					isVendorMatch: pair.matchedByExportIds.includes(vendor.id)
				})),
				run.threshold
			)
		}))
	}
}
