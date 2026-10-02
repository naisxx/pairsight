import 'server-only'
import { z } from 'zod'
import { AppError } from '@/lib/errors/app-error'
import { getSessionUser } from '@/server/auth/session'
import { findingsExport } from '@/server/pairsight/findings'
import { getVisibleRun, runNotFound } from '@/server/pairsight/runs'
import { ownerScope, SANDBOX_SCOPE, type EvaluationScope } from '@/server/pairsight/scope'
import type { DownloadFile } from '../route-factory'

// GET /api/runs/[runId]/findings?format=csv|xlsx: a run's findings as a file.

export const findingsInput = z.object({
	runId: z.string().uuid(),
	format: z.enum(['csv', 'xlsx']).default('csv')
})

// Whose run this is, as a scope to read it with: the signed-in owner's, or
// the public sandbox's (fictional data, so anyone may export it). Anything
// else is a 404, so a run id never confirms someone else's evaluation.
async function resolveRunScope(runId: string): Promise<EvaluationScope> {
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

export async function findingsDownload({
	runId,
	format
}: z.infer<typeof findingsInput>): Promise<DownloadFile> {
	return findingsExport({ scope: await resolveRunScope(runId), runId, format })
}
