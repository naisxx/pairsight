'use server'

import { z } from 'zod'
import { validatedAction } from '@/server/actions/validated-action'
import { requireUser } from '@/server/auth/session'
import {
	blockingRulesSchema,
	countryCodeSchema,
	identityDefinitionSchema,
	identityRoleSchema
} from '@/server/pairsight/schemas'
import { updateEvaluationConfig } from '@/server/pairsight/evaluations'
import { idSchema } from './shared'

export const saveRulesAction = validatedAction({
	input: z.object({
		evaluationId: idSchema,
		identity: identityDefinitionSchema,
		countryCode: countryCodeSchema,
		jevFields: z.array(identityRoleSchema).min(1),
		blockingRules: blockingRulesSchema
	}),
	handler: async ({ evaluationId, identity, countryCode, jevFields, blockingRules }) => {
		const user = await requireUser()
		await updateEvaluationConfig({
			ownerId: user.id,
			evaluationId,
			identitySame: identity.same,
			identityDifferent: identity.different,
			countryCode,
			jevFields,
			blockingRules
		})
		return { saved: true }
	}
})
