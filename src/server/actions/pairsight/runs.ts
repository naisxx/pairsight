'use server'

import { z } from 'zod'
import { validatedAction } from '@/server/actions/validated-action'
import { requireUser } from '@/server/auth/session'
import { advanceRun } from '@/server/pairsight/run-engine'
import { resumeRun, retryFailed, updateRunThreshold } from '@/server/pairsight/runs'
import { startRun } from '@/server/pairsight/start-run'
import { thresholdSchema } from '@/server/pairsight/schemas'
import { goTo, idSchema, revalidateEvaluationPages } from './shared'

export const startRunAction = validatedAction({
	input: z.object({ evaluationId: idSchema }),
	handler: async ({ evaluationId }) => {
		const user = await requireUser()
		const run = await startRun({ ownerId: user.id, evaluationId })
		return goTo(`/evaluations/${evaluationId}/runs/${run.id}`)
	}
})

export const advanceRunAction = validatedAction({
	input: z.object({ runId: idSchema }),
	handler: async ({ runId }) => {
		const user = await requireUser()
		return advanceRun({ ownerId: user.id, runId })
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

export const resumeRunAction = validatedAction({
	input: z.object({ runId: idSchema }),
	handler: async ({ runId }) => {
		const user = await requireUser()
		await resumeRun({ ownerId: user.id, runId })
		return { resumed: true }
	}
})

export const updateThresholdAction = validatedAction({
	input: z.object({ runId: idSchema, threshold: thresholdSchema }),
	handler: async ({ runId, threshold }) => {
		const user = await requireUser()
		await updateRunThreshold({ ownerId: user.id, runId, threshold })
		revalidateEvaluationPages()
		return { threshold }
	}
})
