import 'server-only'
import { notFound } from 'next/navigation'
import { isUuid } from '@/server/pairsight/schemas'
import { AppError } from '@/lib/errors/app-error'
import { requireUserOrRedirect } from '@/server/auth/session'
import { getOwnedRun } from '@/server/pairsight/runs'

// The owner-scoped run for the run, results and pair pages; a foreign,
// malformed or mismatched id is a 404.
export async function loadRun({ id, runId, path }: { id: string; runId: string; path: string }) {
	if (!isUuid(runId)) notFound()
	const user = await requireUserOrRedirect(path)
	try {
		const run = await getOwnedRun({ ownerId: user.id, runId })
		if (run.evaluationId !== id) notFound()
		return { user, run }
	} catch (error) {
		if (error instanceof AppError && error.status === 404) notFound()
		throw error
	}
}
