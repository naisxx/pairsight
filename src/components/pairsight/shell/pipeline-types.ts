// The evaluation pipeline as the sidebar shows it. Built on the server from
// the workspace (src/app/[locale]/evaluations/[id]/workspace.ts) and passed
// to client components as plain data.

import type { EvaluationStatus, StageKey, StageState } from '@/lib/pairsight/stages'

export type { EvaluationStatus, StageKey, StageState }

export type PipelineStage = {
	key: StageKey
	href: string
	state: StageState
	isRunning?: boolean
	// What the stage has produced so far, e.g. "24 records" or "Run 2 · running".
	detail: string
	// For a locked stage: what it's waiting for ("Upload the source records first").
	reason?: string
	// Other paths that belong to this stage (a pair page is part of Results).
	alsoMatches?: string[]
}

export type PipelineData = {
	evaluationName: string
	stages: PipelineStage[]
	status: EvaluationStatus
}

export type Crumb = { label: string; href?: string }

// The signed-in person the shell shows; null in the sandbox when nobody is.
export type ShellViewer = { email: string; name: string } | null

// The sidebar's one section link: the dashboard, or the sandbox's.
export type ShellHome = { href: string; label: string }

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
