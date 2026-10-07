'use server'

import { z } from 'zod'
import { MIN_JEV_FIELDS } from '@/lib/pairsight/entity-types'
import { validatedAction } from '@/server/actions/validated-action'
import { requireUser } from '@/server/auth/session'
import { getCurrentDataset } from '@/server/pairsight/datasets'
import { getOwnedEvaluation, updateEvaluationConfig } from '@/server/pairsight/evaluations'
import {
	countryCodeSchema,
	identityDefinitionSchema,
	identityRoleSchema,
	thresholdSchema
} from '@/server/pairsight/schemas'
import { retrySplink } from '@/server/pairsight/splink/picks'
import { idSchema, revalidateEvaluationPages } from './shared'

export const saveRulesAction = validatedAction({
	input: z.object({
		evaluationId: idSchema,
		identity: identityDefinitionSchema,
		countryCode: countryCodeSchema,
		// One field alone gives Jev too little to tell two people apart.
		jevFields: z.array(identityRoleSchema).min(MIN_JEV_FIELDS),
		threshold: thresholdSchema
	}),
	handler: async ({ evaluationId, identity, countryCode, jevFields, threshold }) => {
		const user = await requireUser()
		await updateEvaluationConfig({
			ownerId: user.id,
			evaluationId,
			identitySame: identity.same,
			identityDifferent: identity.different,
			countryCode,
			jevFields,
			threshold
		})
		revalidateEvaluationPages()
		return { saved: true }
	}
})

// "Try again" on the Plan when PairSight couldn't work out which pairs to
// check: the records are scored again in the background.
export const retrySuggestionsAction = validatedAction({
	input: z.object({ evaluationId: idSchema }),
	handler: async ({ evaluationId }) => {
		const user = await requireUser()
		await getOwnedEvaluation({ ownerId: user.id, id: evaluationId })
		const dataset = await getCurrentDataset(evaluationId)
		if (dataset != null) await retrySplink(dataset.id)
		revalidateEvaluationPages()
		return { retried: true }
	}
})
