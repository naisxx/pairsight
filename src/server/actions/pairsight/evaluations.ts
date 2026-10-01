'use server'

import { z } from 'zod'
import { NAME_MAX_LENGTH } from '@/lib/pairsight/input-limits'
import { validatedAction } from '@/server/actions/validated-action'
import { requireUser } from '@/server/auth/session'
import {
	createEvaluation,
	deleteEvaluation,
	renameEvaluation
} from '@/server/pairsight/evaluations'
import { goTo, idSchema, revalidateEvaluationPages } from './shared'

const nameSchema = z.string().trim().min(1).max(NAME_MAX_LENGTH)

export const createEvaluationAction = validatedAction({
	input: z.object({ name: nameSchema }),
	handler: async ({ name }) => {
		const user = await requireUser()
		const evaluation = await createEvaluation({ ownerId: user.id, name })
		return goTo(`/evaluations/${evaluation.id}/records`)
	}
})

export const renameEvaluationAction = validatedAction({
	input: z.object({ evaluationId: idSchema, name: nameSchema }),
	handler: async ({ evaluationId, name }) => {
		const user = await requireUser()
		await renameEvaluation({ ownerId: user.id, evaluationId, name })
		revalidateEvaluationPages()
		return { renamed: true }
	}
})

export const deleteEvaluationAction = validatedAction({
	input: z.object({ evaluationId: idSchema }),
	handler: async ({ evaluationId }) => {
		const user = await requireUser()
		await deleteEvaluation({ ownerId: user.id, evaluationId })
		revalidateEvaluationPages()
		return { deleted: true }
	}
})
