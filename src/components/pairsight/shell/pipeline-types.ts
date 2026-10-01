// The evaluation pipeline as the sidebar shows it. Built on the server from
// the workspace (src/app/[locale]/evaluations/[id]/workspace.ts) and passed
// to client components as plain data.

export type StageKey = 'records' | 'vendors' | 'rules' | 'plan' | 'run' | 'results'

// done: finished · active: the next thing to do (or the run in progress)
// next: reachable, not yet the focus · locked: needs an earlier stage first
export type StageState = 'done' | 'active' | 'next' | 'locked'

export type PipelineStage = {
	key: StageKey
	href: string
	state: StageState
	isRunning?: boolean
	// What the stage has produced so far, e.g. "24 records" or "Run 2 · running".
	detail: string
	// Other paths that belong to this stage (a pair page is part of Results).
	alsoMatches?: string[]
}

export type PipelineTone = 'action' | 'success' | 'danger'

export type PipelineData = {
	evaluationName: string
	stages: PipelineStage[]
	status: { tone: PipelineTone; label: string }
}

export type Crumb = { label: string; href?: string }

function matchLength(stage: PipelineStage, pathname: string): number {
	const matches = [stage.href, ...(stage.alsoMatches ?? [])].filter(
		(href) => pathname === href || pathname.startsWith(`${href}/`)
	)
	return Math.max(0, ...matches.map((href) => href.length))
}

// The stage the current page belongs to. The most specific match wins:
// /runs/x/results is Results, not Run.
export function currentStageKey(stages: PipelineStage[], pathname: string): StageKey | undefined {
	return stages
		.map((stage) => ({ key: stage.key, length: matchLength(stage, pathname) }))
		.filter((candidate) => candidate.length > 0)
		.sort((a, b) => b.length - a.length)[0]?.key
}
