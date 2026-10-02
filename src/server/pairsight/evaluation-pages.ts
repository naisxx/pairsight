import 'server-only'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { isUuid } from '@/server/pairsight/schemas'
import type { PipelineData, PipelineStage } from '@/components/pairsight/shell/pipeline-types'
import {
	evaluationStatus,
	stageHref,
	stageStates,
	type StageAccess,
	type StageInput,
	type StageKey
} from '@/lib/pairsight/stages'
import { AppError } from '@/lib/errors/app-error'
import { requireUserOrRedirect } from '@/server/auth/session'
import { parseBlockingRules } from '@/server/pairsight/json'
import { getWorkspace } from '@/server/pairsight/workspace'

// Shared by the workspace layout and its step pages: the owner-scoped
// workspace (a foreign or malformed id is a 404), the step states, and the
// pipeline the sidebar shows.

type Workspace = Awaited<ReturnType<typeof getWorkspace>>

export type Step = {
	key: StageKey
	href: string
	state: StageAccess
	alsoMatches?: string[]
}

// `stage` gates the page the way the pipeline does: a locked stage can't be
// opened by its URL either, it redirects to where the evaluation is up to.
export async function loadWorkspace(id: string, path: string, stage?: StageKey) {
	if (!isUuid(id)) notFound()
	const user = await requireUserOrRedirect(path)
	const workspace = await getOwnedWorkspace(user.id, id)
	if (stage != null) {
		const steps = workspaceSteps(id, workspace)
		if (steps.find((step) => step.key === stage)?.state === 'locked') {
			const locale = await getLocale()
			redirect({ href: landingHref(id, steps), locale })
		}
	}
	return { user, workspace }
}

async function getOwnedWorkspace(ownerId: string, evaluationId: string) {
	try {
		return await getWorkspace({ ownerId, evaluationId })
	} catch (error) {
		if (error instanceof AppError && error.status === 404) notFound()
		throw error
	}
}

// Where opening the evaluation lands: its latest results once a run exists,
// else the first step that still needs work (docs/PairSight-UX-Plan.md §3).
export function landingHref(id: string, steps: Step[]): string {
	const results = steps.find((step) => step.key === 'results')
	const target =
		results != null && results.state !== 'locked'
			? results
			: (steps.find((step) => step.state === 'available') ?? steps[0])
	return target?.href ?? `/evaluations/${id}/records`
}

// A stage's own page when it's open, else the landing. For /run and
// /results, which only redirect: the real pages live under a run.
export function stageOrLandingHref(id: string, steps: Step[], key: StageKey): string {
	const step = steps.find((candidate) => candidate.key === key)
	return step == null || step.state === 'locked' ? landingHref(id, steps) : step.href
}

function stageInput(workspace: Workspace): StageInput {
	const latestRun = workspace.runs[0]
	return {
		hasRecords: workspace.dataset != null,
		hasVendors: workspace.vendorExports.length > 0,
		hasUnfinishedVendors: workspace.vendorDraftCount > 0,
		latestRun: latestRun == null ? null : { id: latestRun.id, status: latestRun.status }
	}
}

export function workspaceSteps(id: string, workspace: Workspace): Step[] {
	const base = `/evaluations/${id}`
	const latestRunId = workspace.runs[0]?.id ?? null
	// Every run's pages belong to Run, and its results and pairs to Results.
	const alsoMatches: Partial<Record<StageKey, string[]>> = {
		run: workspace.runs.map((run) => `${base}/runs/${run.id}`),
		results: workspace.runs.flatMap((run) => [
			`${base}/runs/${run.id}/results`,
			`${base}/runs/${run.id}/pairs`
		])
	}
	return stageStates(stageInput(workspace)).map((stage) => ({
		key: stage.key,
		href: stageHref(id, stage.key, latestRunId),
		state: stage.access,
		alsoMatches: alsoMatches[stage.key]
	}))
}

// The pipeline: each stage's state and what it has produced so far, plus a
// one-line status for the evaluation. Built from the workspace already
// loaded for the page, so it costs no extra queries.
export async function workspacePipeline(id: string, workspace: Workspace): Promise<PipelineData> {
	const t = await getTranslations('Pipeline')
	const latestRun = workspace.runs[0]
	const input = stageInput(workspace)
	const steps = workspaceSteps(id, workspace)
	const states = new Map(stageStates(input).map((stage) => [stage.key, stage.state]))

	const vendorPairs = workspace.vendorExports.reduce((sum, vendor) => sum + vendor.pairCount, 0)
	const rulesOn = parseBlockingRules(workspace.evaluation.blockingRules).length
	const details: Record<StageKey, string> = {
		records:
			workspace.dataset == null
				? t('recordsEmpty')
				: t('records', { count: workspace.dataset.rowCount }),
		vendors:
			workspace.vendorExports.length === 0
				? workspace.vendorDraftCount > 0
					? t('vendorsInProgress', { count: workspace.vendorDraftCount })
					: t('vendorsEmpty')
				: t('vendors', { count: workspace.vendorExports.length, pairs: vendorPairs }),
		rules: t('rules', { count: rulesOn }),
		plan: latestRun == null ? t('planReady') : t('plan', { pairs: latestRun.pairCount }),
		run:
			latestRun == null
				? t('runNone')
				: latestRun.status === 'running'
					? t('runRunning', { number: latestRun.number })
					: latestRun.status === 'stopped'
						? t('runStopped', { number: latestRun.number })
						: t('runDone', { number: latestRun.number, pairs: latestRun.pairCount }),
		results:
			latestRun == null
				? t('resultsNone')
				: latestRun.status === 'completed'
					? t('resultsReady', { number: latestRun.number })
					: t('resultsPending', { number: latestRun.number })
	}

	// What a locked stage is waiting for: records unlock vendors and rules,
	// records plus a vendor unlock the plan, and a started run unlocks the rest.
	const lockedReasons: Partial<Record<StageKey, string>> = {
		vendors: t('lockedNeedsRecords'),
		rules: t('lockedNeedsRecords'),
		plan: t('lockedNeedsRecordsAndVendor'),
		run: t('lockedNeedsPlan'),
		results: t('lockedNeedsRun')
	}

	const stages: PipelineStage[] = steps.map((step) => ({
		key: step.key,
		href: step.href,
		alsoMatches: step.alsoMatches,
		state: states.get(step.key) ?? 'locked',
		isRunning: step.key === 'run' && latestRun?.status === 'running',
		detail: step.state === 'locked' ? t('locked') : details[step.key],
		reason: step.state === 'locked' ? lockedReasons[step.key] : undefined
	}))
	const status = evaluationStatus(input)

	return { evaluationName: workspace.evaluation.name, stages, status }
}
