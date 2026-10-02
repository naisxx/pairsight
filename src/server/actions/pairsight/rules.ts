'use server'

import { z } from 'zod'
import { validatedAction } from '@/server/actions/validated-action'
import { requireUser } from '@/server/auth/session'
import {
	blockingFieldSchema,
	blockingRulesSchema,
	countryCodeSchema,
	identityDefinitionSchema,
	identityRoleSchema
} from '@/server/pairsight/schemas'
import { removeBlockingRule, updateEvaluationConfig } from '@/server/pairsight/evaluations'
import { previewRuleStats } from '@/server/pairsight/rules-preview'
import { ownerScope } from '@/server/pairsight/scope'
import { MAX_RULE_FIELDS, MIN_JEV_FIELDS } from '@/lib/pairsight/custom-rules'
import { idSchema, revalidateEvaluationPages } from './shared'

export const saveRulesAction = validatedAction({
	input: z.object({
		evaluationId: idSchema,
		identity: identityDefinitionSchema,
		countryCode: countryCodeSchema,
		// One field alone gives Jev too little to tell two people apart.
		jevFields: z.array(identityRoleSchema).min(MIN_JEV_FIELDS),
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
		revalidateEvaluationPages()
		return { saved: true }
	}
})

// Live stats for a custom rule while it's being built, before it's saved.
export const previewRuleAction = validatedAction({
	input: z.object({
		evaluationId: idSchema,
		fields: z.array(blockingFieldSchema).min(1).max(MAX_RULE_FIELDS),
		countryCode: countryCodeSchema
	}),
	handler: async ({ evaluationId, fields, countryCode }) => {
		const user = await requireUser()
		return previewRuleStats({
			scope: ownerScope(user.id),
			evaluationId,
			fields,
			country: countryCode
		})
	}
})

// "Turn off" on the Plan's over-limit list: removes one rule from the saved
// configuration.
export const turnOffRuleAction = validatedAction({
	input: z.object({ evaluationId: idSchema, ruleId: z.string().min(1) }),
	handler: async ({ evaluationId, ruleId }) => {
		const user = await requireUser()
		await removeBlockingRule({ ownerId: user.id, evaluationId, ruleId })
		revalidateEvaluationPages()
		return { removed: true }
	}
})
