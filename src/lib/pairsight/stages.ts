// Where an evaluation is in its pipeline, from three facts: whether it has
// records, whether it has a vendor export for them, and its latest run's
// status. Shared by the workspace sidebar (src/app/[locale]/evaluations/[id]/
// workspace.ts) and the Evaluations dashboard, so both agree on every stage.

export const STAGE_KEYS = ['records', 'vendors', 'rules', 'plan', 'run', 'results'] as const
export type StageKey = (typeof STAGE_KEYS)[number]

// complete: its work is saved · available: you can open it · locked: an
// earlier stage comes first.
export type StageAccess = 'complete' | 'available' | 'locked'

// done: finished · active: the next thing to do (or the run in progress)
// next: reachable, not yet the focus · locked: needs an earlier stage first
export type StageState = 'done' | 'active' | 'next' | 'locked'

// The evaluation's overall state, shown as a chip.
export type EvaluationStatus = 'draft' | 'readyToRun' | 'running' | 'needsAttention' | 'complete'

export type RunStatus = 'running' | 'completed' | 'stopped'

export type StageInput = {
	hasRecords: boolean
	hasVendors: boolean
	latestRun: { id: string; status: RunStatus } | null
}

export type StageSummary = { key: StageKey; access: StageAccess; state: StageState }

function access({ hasRecords, hasVendors, latestRun }: StageInput): Record<StageKey, StageAccess> {
	const afterRecords = !hasRecords ? 'locked' : hasVendors ? 'complete' : 'available'
	return {
		records: hasRecords ? 'complete' : 'available',
		vendors: afterRecords,
		rules: afterRecords,
		plan: hasRecords && hasVendors ? (latestRun == null ? 'available' : 'complete') : 'locked',
		run: latestRun == null ? 'locked' : latestRun.status === 'completed' ? 'complete' : 'available',
		results: latestRun == null ? 'locked' : 'available'
	}
}

export function stageStates(input: StageInput): StageSummary[] {
	const byKey = access(input)
	const status = input.latestRun?.status
	const isRunning = status === 'running'
	// Results open as soon as a run exists, but are only done once it completes.
	const isDone = (key: StageKey) =>
		byKey[key] === 'complete' || (key === 'results' && status === 'completed')
	// The first reachable stage that isn't finished is where the work is.
	const activeKey = isRunning
		? 'run'
		: STAGE_KEYS.find((key) => byKey[key] === 'available' && !isDone(key))
	return STAGE_KEYS.map((key) => ({
		key,
		access: byKey[key],
		state:
			byKey[key] === 'locked'
				? 'locked'
				: isDone(key) && !(key === 'run' && isRunning)
					? 'done'
					: key === activeKey
						? 'active'
						: 'next'
	}))
}

// The stage to continue from; null once every stage is done.
export function activeStage(stages: StageSummary[]): StageKey | null {
	return stages.find((stage) => stage.state === 'active')?.key ?? null
}

export function evaluationStatus(input: StageInput): EvaluationStatus {
	const { latestRun } = input
	if (latestRun == null) return access(input).plan === 'locked' ? 'draft' : 'readyToRun'
	if (latestRun.status === 'running') return 'running'
	if (latestRun.status === 'stopped') return 'needsAttention'
	return 'complete'
}

// Each stage's page. Run and Results point at the latest run once there is one.
export function stageHref(evaluationId: string, key: StageKey, latestRunId: string | null): string {
	const base = `/evaluations/${evaluationId}`
	if (key === 'run' && latestRunId != null) return `${base}/runs/${latestRunId}`
	if (key === 'results' && latestRunId != null) return `${base}/runs/${latestRunId}/results`
	return `${base}/${key}`
}
