'use server'

import { z } from 'zod'
import { NAME_MAX_LENGTH } from '@/lib/pairsight/input-limits'
import { validatedAction } from '@/server/actions/validated-action'
import { requireUser } from '@/server/auth/session'
import { createEvaluation } from '@/server/pairsight/evaluations'
import { goTo } from './shared'

export const createEvaluationAction = validatedAction({
	input: z.object({ name: z.string().trim().min(1).max(NAME_MAX_LENGTH) }),
	handler: async ({ name }) => {
		const user = await requireUser()
		const evaluation = await createEvaluation({ ownerId: user.id, name })
		return goTo(`/evaluations/${evaluation.id}/records`)
	}
})
