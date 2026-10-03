import 'server-only'
import { AppError } from '@/lib/errors/app-error'
import { getSessionUser } from '@/server/auth/session'
import { getVisibleRun, runNotFound } from '@/server/pairsight/runs'
import { ownerScope, SANDBOX_SCOPE, type EvaluationScope } from '@/server/pairsight/scope'

// Whose run this is, as a scope to read it with: the signed-in owner's, or
// the public sandbox's (fictional data, so anyone may download it). Anything
// else is a 404, so a run id never confirms someone else's evaluation.
export async function resolveRunScope(runId: string): Promise<EvaluationScope> {
	const user = await getSessionUser()
	const candidates: EvaluationScope[] =
		user == null ? [SANDBOX_SCOPE] : [ownerScope(user.id), SANDBOX_SCOPE]
	for (const scope of candidates) {
		const found = await getVisibleRun({ scope, runId }).then(
			() => true,
			(error: unknown) => {
				if (error instanceof AppError && error.status === 404) return false
				throw error
			}
		)
		if (found) return scope
	}
	throw runNotFound()
}
