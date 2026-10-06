import 'server-only'
import { entityTypeOf, type EntityType } from '@/lib/pairsight/entity-types'
import { db } from '@/server/db/client'
import { runBase, type EvaluationView } from '@/lib/pairsight/evaluation-view'
import { evaluationWhere, type EvaluationScope } from './scope'
import type { VendorMetrics } from '@/lib/pairsight/metrics'
import { statsMetrics } from '@/lib/pairsight/stats'
import { readRunSummary, runVendors, SUMMARY_RUN_SELECT } from './run-summary'
import {
	activeStage,
	evaluationStatus,
	landingStage,
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
	// Where opening it lands (landingStage): results, or where the work is.
	href: string
	name: string
	// What its records are; null until a file is saved.
	entityType: EntityType | null
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
	// The run's results page.
	resultsHref: string
	run: { id: string; number: number; completedAt: Date | null; threshold: number }
	vendors: Array<{ id: string; name: string; metrics: VendorMetrics }>
}

export type Dashboard = {
	rows: DashboardRow[]
	stats: { evaluations: number; withResults: number; inSetup: number; pairsAssessed: number }
	latest: LatestResults | null
}

// `viewOf` gives each evaluation's pages: /evaluations/<id> for an owner,
// /sandbox for the sandbox.
export async function getDashboard({
	scope,
	viewOf
}: {
	scope: EvaluationScope
	viewOf: (evaluationId: string) => EvaluationView
}): Promise<Dashboard> {
	const evaluations = await db.evaluation.findMany({
		where: evaluationWhere(scope),
		orderBy: { updatedAt: 'desc' },
		select: {
			id: true,
			name: true,
			entityType: true,
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
		const { base } = viewOf(evaluation.id)
		return {
			id: evaluation.id,
			href: stageHref(base, landingStage(stages), run?.id ?? null),
			name: evaluation.name,
			// Evaluations from before types existed hold people.
			entityType: dataset == null ? null : entityTypeOf(evaluation.entityType),
			createdAt: evaluation.createdAt,
			updatedAt: evaluation.updatedAt,
			status: evaluationStatus(input),
			stages: stages.map(({ key, state }) => ({ key, state })),
			next:
				nextKey == null
					? null
					: {
							key: nextKey,
							href: stageHref(base, nextKey, run?.id ?? null)
						},
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
						runId: newest.run.id,
						resultsHref: `${runBase(viewOf(newest.evaluation.id), newest.run.id)}/results`
					})
	}
}

// A finished run's metrics per vendor, from its summary (run-summary.ts):
// nothing loaded pair by pair.
async function latestResults({
	evaluationId,
	evaluationName,
	runId,
	resultsHref
}: {
	evaluationId: string
	evaluationName: string
	runId: string
	resultsHref: string
}): Promise<LatestResults> {
	const run = await db.run.findUniqueOrThrow({
		where: { id: runId },
		select: {
			...SUMMARY_RUN_SELECT,
			number: true,
			completedAt: true,
			summary: true,
			summaryVersion: true
		}
	})
	const [vendors, summary] = await Promise.all([runVendors(run.exportIds), readRunSummary(run)])
	return {
		evaluationId,
		evaluationName,
		resultsHref,
		run: { id: run.id, number: run.number, completedAt: run.completedAt, threshold: run.threshold },
		vendors: vendors.map((vendor) => ({
			id: vendor.id,
			name: vendor.name,
			metrics: statsMetrics(summary.rows, summary.vendorIds.indexOf(vendor.id))
		}))
	}
}
