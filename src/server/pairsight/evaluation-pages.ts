import 'server-only'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/routing'
import { isUuid } from '@/server/pairsight/schemas'
import type { PipelineData, PipelineStage } from '@/components/pairsight/shell/pipeline-types'
import {
	evaluationStatus,
	landingStage,
	stageHref,
	stageStates,
	type StageAccess,
	type StageInput,
	type StageKey
} from '@/lib/pairsight/stages'
import { AppError } from '@/lib/errors/app-error'
import {
	ownerView,
	runBase,
	sandboxView,
	type EvaluationView
} from '@/lib/pairsight/evaluation-view'
import { getProfileName, getSessionUser, requireUserOrRedirect } from '@/server/auth/session'
import { parseBlockingRules, parseColumnRoles } from '@/server/pairsight/json'
import { mappedIdentityRoles, type IdentityRole } from '@/server/pairsight/fields'
import { runnableRules } from '@/lib/pairsight/rule-fields'
import { getVisibleRun } from '@/server/pairsight/runs'
import { db } from '@/server/db/client'
import {
	evaluationWhere,
	ownerScope,
	SANDBOX_SCOPE,
	type EvaluationScope
} from '@/server/pairsight/scope'
import { getWorkspace } from '@/server/pairsight/workspace'

// Shared by every evaluation page, the owner's (/evaluations/<id>) and the
// sandbox's (/sandbox): who's looking, what they may see, the workspace (a
// foreign or malformed id is a 404), the step states, and the pipeline the
// sidebar shows.

// Which evaluation a page is for. An owner's page names its id and its own
// path (to come back to after signing in); a sandbox one only its id.
export type EvaluationTarget =
	{ kind: 'owner'; id: string; path: string } | { kind: 'sandbox'; id: string }

export function sandboxTarget(id: string): EvaluationTarget {
	return { kind: 'sandbox', id }
}

// The signed-in person, if any. Owner pages require one; the sandbox shows
// the account when there is one and Sign in / Sign up when there isn't.
export type Viewer = { email: string; name: string } | null

type Access = { viewer: Viewer; scope: EvaluationScope; view: EvaluationView }

async function resolveAccess(target: EvaluationTarget): Promise<Access> {
	if (target.kind === 'sandbox') {
		if (!isUuid(target.id)) notFound()
		const user = await getSessionUser()
		const name = user == null ? null : await getProfileName(user.id)
		return {
			viewer: user == null ? null : { email: user.email, name: name ?? user.email },
			scope: SANDBOX_SCOPE,
			view: sandboxView(target.id)
		}
	}
	if (!isUuid(target.id)) notFound()
	const user = await requireUserOrRedirect(target.path)
	return {
		viewer: { email: user.email, name: user.name },
		scope: ownerScope(user.id),
		view: ownerView(target.id)
	}
}

function notFoundOn404(error: unknown): never {
	if (error instanceof AppError && error.status === 404) notFound()
	throw error
}

type Workspace = Awaited<ReturnType<typeof getWorkspace>>

export type Step = {
	key: StageKey
	href: string
	state: StageAccess
	alsoMatches?: string[]
}

export type LoadedWorkspace = Access & { workspace: Workspace }

// `stage` gates the page the way the pipeline does: a locked stage can't be
// opened by its URL either, it redirects to where the evaluation is up to.
export async function loadWorkspace(
	target: EvaluationTarget,
	stage?: StageKey
): Promise<LoadedWorkspace> {
	const access = await resolveAccess(target)
	const workspace = await getWorkspace({
		scope: access.scope,
		evaluationId: access.view.evaluationId
	}).catch(notFoundOn404)
	if (stage != null) {
		const steps = workspaceSteps(access.view, workspace)
		if (steps.find((step) => step.key === stage)?.state === 'locked') {
			const locale = await getLocale()
			redirect({ href: landingHref(access.view, workspace), locale })
		}
	}
	return { ...access, workspace }
}

// The run for the run, results and pair pages; a foreign, malformed or
// mismatched id is a 404.
export async function loadRun(target: EvaluationTarget, runId: string) {
	if (!isUuid(runId)) notFound()
	const access = await resolveAccess(target)
	const run = await getVisibleRun({ scope: access.scope, runId }).catch(notFoundOn404)
	if (run.evaluationId !== access.view.evaluationId) notFound()
	return { ...access, run, base: runBase(access.view, run.id) }
}

// Where opening the evaluation lands: its results once the latest run is
// complete, else the step where the work is (landingStage).
export function landingHref(view: EvaluationView, workspace: Workspace): string {
	const key = landingStage(stageStates(stageInput(workspace)))
	return stageHref(view.base, key, workspace.runs[0]?.id ?? null)
}

// A stage's own page when it's open, else the landing. For /run and
// /results, which only redirect: the real pages live under a run.
export function stageOrLandingHref(
	view: EvaluationView,
	workspace: Workspace,
	key: StageKey
): string {
	const step = workspaceSteps(view, workspace).find((candidate) => candidate.key === key)
	return step == null || step.state === 'locked' ? landingHref(view, workspace) : step.href
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

export function workspaceSteps(view: EvaluationView, workspace: Workspace): Step[] {
	const { base } = view
	const latestRunId = workspace.runs[0]?.id ?? null
	// Every run's results and pairs belong to Results.
	const alsoMatches: Partial<Record<StageKey, string[]>> = {
		results: workspace.runs.flatMap((run) => [
			`${base}/runs/${run.id}/results`,
			`${base}/runs/${run.id}/pairs`
		])
	}
	return stageStates(stageInput(workspace)).map((stage) => ({
		key: stage.key,
		href: stageHref(base, stage.key, latestRunId),
		state: stage.access,
		alsoMatches: alsoMatches[stage.key]
	}))
}

// The pipeline: each stage's state and what it has produced so far, plus a
// one-line status for the evaluation. Built from the workspace already
// loaded for the page, so it costs no extra queries.
export async function workspacePipeline(
	view: EvaluationView,
	workspace: Workspace
): Promise<PipelineData> {
	const t = await getTranslations('Pipeline')
	const latestRun = workspace.runs[0]
	const input = stageInput(workspace)
	const steps = workspaceSteps(view, workspace)
	const states = new Map(stageStates(input).map((stage) => [stage.key, stage.state]))

	const vendorPairs = workspace.vendorExports.reduce((sum, vendor) => sum + vendor.pairCount, 0)
	const mapped =
		workspace.dataset == null
			? new Set<IdentityRole>()
			: mappedIdentityRoles(parseColumnRoles(workspace.dataset.columnRoles))
	const rulesOn = runnableRules(
		parseBlockingRules(workspace.evaluation.blockingRules),
		mapped
	).length
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
		results:
			latestRun == null
				? t('resultsNone')
				: latestRun.status === 'completed'
					? t('resultsReady', { number: latestRun.number })
					: latestRun.status === 'stopped'
						? t('resultsStopped', { number: latestRun.number })
						: t('resultsPending', { number: latestRun.number })
	}

	// What a locked stage is waiting for: records unlock vendors and rules,
	// records plus a vendor unlock the plan, and a started run unlocks the rest.
	const lockedReasons: Partial<Record<StageKey, string>> = {
		vendors: t('lockedNeedsRecords'),
		rules: t('lockedNeedsRecords'),
		plan: t('lockedNeedsRecordsAndVendor'),
		results: t('lockedNeedsRun')
	}

	const stages: PipelineStage[] = steps.map((step) => ({
		key: step.key,
		href: step.href,
		alsoMatches: step.alsoMatches,
		state: states.get(step.key) ?? 'locked',
		isRunning: step.key === 'results' && latestRun?.status === 'running',
		detail: step.state === 'locked' ? t('locked') : details[step.key],
		reason: step.state === 'locked' ? lockedReasons[step.key] : undefined
	}))
	const status = evaluationStatus(input)

	return { evaluationName: workspace.evaluation.name, stages, status }
}

// A sandbox evaluation's prepared run (or the latest of any, for the
// sandbox's dashboard), for the banner: which Jev model judged it and when.
// Null until `pnpm demo:seed` has run on this database.
export async function getSandboxRecording(evaluationId?: string) {
	const run = await db.run.findFirst({
		where: {
			evaluation: evaluationWhere(SANDBOX_SCOPE),
			...(evaluationId == null ? {} : { evaluationId }),
			origin: 'prepared'
		},
		orderBy: { number: 'desc' },
		select: { jevModel: true, completedAt: true }
	})
	return run == null ? null : { model: run.jevModel, recordedAt: run.completedAt ?? new Date() }
}
