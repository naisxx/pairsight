import { SANDBOX_BASE } from './sandbox'

// Where an evaluation's screens live and whether they can change anything.
// The same screens serve an owner's evaluation (/evaluations/<id>) and the
// public sandbox (/sandbox, read-only), so every link is built from `base`
// and every action checks `isReadOnly` — never a hard-coded path.
export type EvaluationView = {
	evaluationId: string
	// The evaluation's own pages: `${base}/records`, `${base}/runs/<id>`, …
	base: string
	// The list it belongs to: the dashboard, or the sandbox's.
	homeHref: string
	isReadOnly: boolean
}

export function ownerView(evaluationId: string): EvaluationView {
	return {
		evaluationId,
		base: `/evaluations/${evaluationId}`,
		homeHref: '/evaluations',
		isReadOnly: false
	}
}

export function sandboxView(evaluationId: string): EvaluationView {
	return {
		evaluationId,
		base: `${SANDBOX_BASE}/${evaluationId}`,
		homeHref: SANDBOX_BASE,
		isReadOnly: true
	}
}

export function runBase(view: EvaluationView, runId: string): string {
	return `${view.base}/runs/${runId}`
}

// ?runs=<run id> opens the Runs centre on that run; a run's old page sends
// you to its results with it.
export const RUNS_PARAM = 'runs'
