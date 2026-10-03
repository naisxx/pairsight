import 'server-only'
import { db } from '@/server/db/client'
import type { EvaluationView } from '@/lib/pairsight/evaluation-view'
import { runBase } from '@/lib/pairsight/evaluation-view'
import type { BlockingRule } from './blocking'
import { parseBlockingRules } from './json'
import { getRunProgress, type RunProgress } from './runs'
import { evaluationWhere, type EvaluationScope } from './scope'

// The Runs centre (docs/PairSight-UX-Plan.md, "What shipped"): every run the
// viewer can see, across their evaluations, newest first. A card shows the
// run at a glance and, expanded, everything it was run with: each run keeps a
// frozen copy of its settings, so this is what produced its results.

// Enough history to find a recent run; older ones stay reachable from their
// evaluation's run switcher.
const RUN_LIMIT = 30

// Of a run's judged pairs, how many were judged before it started: scores
// reused from earlier runs, not judged (or paid for) again.
export function countReusedJudgments(run: { id: string; createdAt: Date }) {
	return db.runPair.count({
		where: {
			runId: run.id,
			assessment: { status: 'succeeded', completedAt: { lt: run.createdAt } }
		}
	})
}

export type RunCard = {
	id: string
	number: number
	status: 'running' | 'completed' | 'stopped'
	stopReason: string | null
	evaluation: { id: string; name: string }
	resultsHref: string
	createdAt: Date
	completedAt: Date | null
	threshold: number
	// What Jev reported for this run's judgments, else what was requested.
	model: string
	progress: RunProgress
	// Of the judged pairs, how many were saved from earlier runs.
	reused: number
	settings: {
		identitySame: string
		identityDifferent: string
		countryCode: string
		jevFields: string[]
		rules: BlockingRule[]
		vendors: Array<{ name: string; fileName: string; format: string }>
	}
}

// The ids of runs still going: what the shell drives and counts. One cheap
// query, made on every page.
export async function activeRunIds(scope: EvaluationScope): Promise<string[]> {
	const runs = await db.run.findMany({
		where: { status: 'running', evaluation: evaluationWhere(scope) },
		orderBy: { createdAt: 'desc' },
		select: { id: true }
	})
	return runs.map((run) => run.id)
}

export async function listRunCards({
	scope,
	viewOf
}: {
	scope: EvaluationScope
	viewOf: (evaluationId: string) => EvaluationView
}): Promise<RunCard[]> {
	const runs = await db.run.findMany({
		where: { evaluation: evaluationWhere(scope) },
		orderBy: { createdAt: 'desc' },
		take: RUN_LIMIT,
		select: {
			id: true,
			number: true,
			status: true,
			stopReason: true,
			createdAt: true,
			completedAt: true,
			threshold: true,
			jevModel: true,
			identitySame: true,
			identityDifferent: true,
			countryCode: true,
			jevFields: true,
			blockingRules: true,
			exportIds: true,
			evaluation: { select: { id: true, name: true } }
		}
	})
	const exportIds = [...new Set(runs.flatMap((run) => run.exportIds))]
	const exports = await db.vendorExport.findMany({
		where: { id: { in: exportIds } },
		select: { id: true, name: true, fileName: true, format: true }
	})
	const exportById = new Map(exports.map((vendorExport) => [vendorExport.id, vendorExport]))

	return Promise.all(
		runs.map(async (run): Promise<RunCard> => {
			const [progress, reused, reported] = await Promise.all([
				getRunProgress(run.id),
				countReusedJudgments(run),
				db.assessment.findFirst({
					where: { runPairs: { some: { runId: run.id } }, modelReported: { not: null } },
					select: { modelReported: true }
				})
			])
			const view = viewOf(run.evaluation.id)
			return {
				id: run.id,
				number: run.number,
				status: run.status,
				stopReason: run.stopReason,
				evaluation: run.evaluation,
				resultsHref: `${runBase(view, run.id)}/results`,
				createdAt: run.createdAt,
				completedAt: run.completedAt,
				threshold: run.threshold,
				model: reported?.modelReported ?? run.jevModel,
				progress,
				reused,
				settings: {
					identitySame: run.identitySame,
					identityDifferent: run.identityDifferent,
					countryCode: run.countryCode,
					jevFields: run.jevFields,
					rules: parseBlockingRules(run.blockingRules),
					vendors: run.exportIds.flatMap((id) => {
						const vendorExport = exportById.get(id)
						return vendorExport == null ? [] : [vendorExport]
					})
				}
			}
		})
	)
}
