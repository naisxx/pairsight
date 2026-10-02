import { SANDBOX_EVALUATION_ID } from '@/lib/pairsight/sandbox'

// Who is looking at an evaluation. An owner sees their own live evaluations;
// the sandbox sees only the one prepared demo evaluation, read-only. Reads
// take a scope; mutations keep taking an owner id (getOwnedEvaluation /
// getOwnedRun), so no request can ever change the sandbox: a demo row never
// matches an owner filter.
export type EvaluationScope = { kind: 'owner'; ownerId: string } | { kind: 'sandbox' }

export function ownerScope(ownerId: string): EvaluationScope {
	return { kind: 'owner', ownerId }
}

export const SANDBOX_SCOPE: EvaluationScope = { kind: 'sandbox' }

// The Prisma filter on `evaluations` for what a scope may see.
export function evaluationWhere(scope: EvaluationScope) {
	return scope.kind === 'owner'
		? { ownerId: scope.ownerId, kind: 'live' as const }
		: { id: SANDBOX_EVALUATION_ID, kind: 'demo' as const }
}

// A primitive key for React's per-request cache.
export function scopeKey(scope: EvaluationScope): string {
	return scope.kind === 'owner' ? `owner:${scope.ownerId}` : 'sandbox'
}
