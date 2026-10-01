import 'server-only'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isUuid } from '@/server/pairsight/schemas'
import type {
	PipelineData,
	PipelineStage,
	StageKey,
	StageState
} from '@/components/pairsight/shell/pipeline-types'
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
	state: 'complete' | 'available' | 'locked'
	alsoMatches?: string[]
}

export async function loadWorkspace(id: string, path: string) {
	if (!isUuid(id)) notFound()
	const user = await requireUserOrRedirect(path)
	try {
		return { user, workspace: await getWorkspace({ ownerId: user.id, evaluationId: id }) }
	} catch (error) {
		if (error instanceof AppError && error.status === 404) notFound()
		throw error
	}
}

export function workspaceSteps(id: string, workspace: Workspace): Step[] {
	const base = `/evaluations/${id}`
	const hasRecords = workspace.dataset != null
	const hasVendors = workspace.vendorExports.length > 0
	const latestRun = workspace.runs[0]
	return [
		{ key: 'records', href: `${base}/records`, state: hasRecords ? 'complete' : 'available' },
		{
			key: 'vendors',
			href: `${base}/vendors`,
			state: !hasRecords ? 'locked' : hasVendors ? 'complete' : 'available'
		},
		{
			key: 'rules',
			href: `${base}/rules`,
			state: !hasRecords ? 'locked' : hasVendors ? 'complete' : 'available'
		},
		{
			key: 'plan',
			href: `${base}/plan`,
			state: hasRecords && hasVendors ? (latestRun ? 'complete' : 'available') : 'locked'
		},
		{
			key: 'run',
			href: latestRun == null ? `${base}/run` : `${base}/runs/${latestRun.id}`,
			alsoMatches: workspace.runs.map((run) => `${base}/runs/${run.id}`),
			state:
				latestRun == null ? 'locked' : latestRun.status === 'completed' ? 'complete' : 'available'
		},
		{
			key: 'results',
			href: latestRun == null ? `${base}/results` : `${base}/runs/${latestRun.id}/results`,
			state: latestRun == null ? 'locked' : 'available',
			alsoMatches: workspace.runs.flatMap((run) => [
				`${base}/runs/${run.id}/results`,
				`${base}/runs/${run.id}/pairs`
			])
		}
	]
}

// The pipeline: each stage's state and what it has produced so far, plus a
// one-line status for the evaluation. Built from the workspace already
// loaded for the page, so it costs no extra queries.
export async function workspacePipeline(id: string, workspace: Workspace): Promise<PipelineData> {
	const t = await getTranslations('Pipeline')
	const latestRun = workspace.runs[0]
	const isRunning = latestRun?.status === 'running'
	const steps = workspaceSteps(id, workspace)
	// Results are "available" as soon as a run exists, but only done once it
	// has completed.
	const isDone = (step: Step) =>
		step.state === 'complete' || (step.key === 'results' && latestRun?.status === 'completed')
	// The first reachable stage that isn't finished is where the work is.
	const activeKey = isRunning
		? 'run'
		: steps.find((step) => step.state === 'available' && !isDone(step))?.key

	const vendorPairs = workspace.vendorExports.reduce((sum, vendor) => sum + vendor.pairCount, 0)
	const rulesOn = parseBlockingRules(workspace.evaluation.blockingRules).length
	const details: Record<StageKey, string> = {
		records:
			workspace.dataset == null
				? t('recordsEmpty')
				: t('records', { count: workspace.dataset.rowCount }),
		vendors:
			workspace.vendorExports.length === 0
				? t('vendorsEmpty')
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

	const stages: PipelineStage[] = steps.map((step) => {
		const state: StageState =
			step.state === 'locked'
				? 'locked'
				: isDone(step) && !(step.key === 'run' && isRunning)
					? 'done'
					: step.key === activeKey
						? 'active'
						: 'next'
		return {
			key: step.key,
			href: step.href,
			alsoMatches: step.alsoMatches,
			state,
			isRunning: step.key === 'run' && isRunning,
			detail: step.state === 'locked' ? t('locked') : details[step.key]
		}
	})

	const done = stages.filter((stage) => stage.state === 'done').length
	const status: PipelineData['status'] =
		latestRun == null
			? { tone: 'action', label: t('statusSetup', { done, total: stages.length }) }
			: latestRun.status === 'running'
				? { tone: 'action', label: t('statusRunning', { number: latestRun.number }) }
				: latestRun.status === 'stopped'
					? { tone: 'danger', label: t('statusStopped', { number: latestRun.number }) }
					: { tone: 'success', label: t('statusComplete', { number: latestRun.number }) }

	return { evaluationName: workspace.evaluation.name, stages, status }
}
