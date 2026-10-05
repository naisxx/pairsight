'use server'

import { z } from 'zod'
import { validatedAction } from '@/server/actions/validated-action'
import { requireUser } from '@/server/auth/session'
import { retryPair } from '@/server/pairsight/run-engine'
import {
	getOwnedRun,
	getRunProgress,
	pauseRun,
	resumeRun,
	retryFailed
} from '@/server/pairsight/runs'
import { startRun } from '@/server/pairsight/start-run'
import { ownerView, sandboxView } from '@/lib/pairsight/evaluation-view'
import { listRunCards } from '@/server/pairsight/run-centre'
import { ownerScope, SANDBOX_SCOPE } from '@/server/pairsight/scope'
import { idSchema, revalidateEvaluationPages } from './shared'

// Starts a run and stays on the page: the background worker checks its pairs,
// and the Runs centre opens on it, follows it and takes you to its results
// when it's done.
export const startRunAction = validatedAction({
	input: z.object({ evaluationId: idSchema }),
	handler: async ({ evaluationId }) => {
		const user = await requireUser()
		const run = await startRun({ ownerId: user.id, evaluationId })
		// The shell (pipeline, status, breadcrumb) now has a run to show.
		revalidateEvaluationPages()
		return { runId: run.id }
	}
})

// The Runs centre's cards: the signed-in viewer's runs, or the sandbox's.
export const listRunsAction = validatedAction({
	input: z.object({ sandbox: z.boolean() }),
	handler: async ({ sandbox }) => {
		if (sandbox) return listRunCards({ scope: SANDBOX_SCOPE, viewOf: sandboxView })
		const user = await requireUser()
		return listRunCards({ scope: ownerScope(user.id), viewOf: ownerView })
	}
})

// How far a run has got: what the Runs centre polls while the worker runs it.
export const runProgressAction = validatedAction({
	input: z.object({ runId: idSchema }),
	handler: async ({ runId }) => {
		const user = await requireUser()
		await getOwnedRun({ ownerId: user.id, runId })
		return getRunProgress(runId)
	}
})

export const pauseRunAction = validatedAction({
	input: z.object({ runId: idSchema }),
	handler: async ({ runId }) => {
		const user = await requireUser()
		await pauseRun({ ownerId: user.id, runId })
		return { paused: true }
	}
})

export const retryFailedAction = validatedAction({
	input: z.object({ runId: idSchema }),
	handler: async ({ runId }) => {
		const user = await requireUser()
		await retryFailed({ ownerId: user.id, runId })
		return { retried: true }
	}
})

export const retryPairAction = validatedAction({
	input: z.object({ runId: idSchema, pairId: idSchema }),
	handler: async ({ runId, pairId }) => {
		const user = await requireUser()
		const status = await retryPair({ ownerId: user.id, runId, pairId })
		revalidateEvaluationPages()
		return { status }
	}
})

export const resumeRunAction = validatedAction({
	input: z.object({ runId: idSchema }),
	handler: async ({ runId }) => {
		const user = await requireUser()
		await resumeRun({ ownerId: user.id, runId })
		return { resumed: true }
	}
})
