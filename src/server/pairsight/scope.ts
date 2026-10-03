// Who is looking at an evaluation. An owner sees their own live evaluations;
// the sandbox sees only the prepared demo evaluations, read-only. Reads take
// a scope; mutations keep taking an owner id (getOwnedEvaluation /
// getOwnedRun), so no request can ever change the sandbox: a demo row never
// matches an owner filter.
export type EvaluationScope = { kind: 'owner'; ownerId: string } | { kind: 'sandbox' }

export function ownerScope(ownerId: string): EvaluationScope {
	return { kind: 'owner', ownerId }
}

export const SANDBOX_SCOPE: EvaluationScope = { kind: 'sandbox' }

// The Prisma filter on `evaluations` for what a scope may see. Callers spread
// it beside an `id`, so it never sets one itself. Demo evaluations are only
// ever made by `pnpm demo:seed`: the sandbox's, owned by no one.
export function evaluationWhere(scope: EvaluationScope) {
	return scope.kind === 'owner'
		? { ownerId: scope.ownerId, kind: 'live' as const }
		: { ownerId: null, kind: 'demo' as const }
}

// A primitive key for React's per-request cache.
export function scopeKey(scope: EvaluationScope): string {
	return scope.kind === 'owner' ? `owner:${scope.ownerId}` : 'sandbox'
}
