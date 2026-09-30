import 'server-only'
import { z } from 'zod'
import { AppError } from '@/lib/errors/app-error'
import { db } from '@/server/db/client'
import { DEFAULT_IDENTITY } from './judgment'
import type { blockingRuleSchema } from './schemas'

// Owner-scoped data access for PairSight (docs/rules/auth.md: authorization
// lives in the action layer, because Prisma bypasses RLS). Every function
// takes the signed-in user's id and scopes by it; an evaluation that doesn't
// exist and one that belongs to someone else are the same 404, so ids can't
// be probed. Datasets, vendor exports and the workspace build on
// getOwnedEvaluation.

export const DEFAULT_BLOCKING_RULES: Array<z.infer<typeof blockingRuleSchema>> = [
	{ id: 'email', fields: ['email'] },
	{ id: 'phone', fields: ['phone'] },
	{ id: 'name_postcode', fields: ['name', 'postcode'] }
]

export function evaluationNotFound() {
	return new AppError('That evaluation doesn’t exist, or you don’t have access to it.', {
		status: 404,
		code: 'not_found'
	})
}

export async function listEvaluations(ownerId: string) {
	return db.evaluation.findMany({
		where: { ownerId, kind: 'live' },
		orderBy: { updatedAt: 'desc' },
		select: {
			id: true,
			name: true,
			updatedAt: true,
			runs: {
				orderBy: { number: 'desc' },
				take: 1,
				select: { number: true, status: true, pairCount: true, createdAt: true }
			}
		}
	})
}

export async function createEvaluation({ ownerId, name }: { ownerId: string; name: string }) {
	return db.evaluation.create({
		data: {
			ownerId,
			name,
			identitySame: DEFAULT_IDENTITY.same,
			identityDifferent: DEFAULT_IDENTITY.different,
			jevFields: [],
			blockingRules: DEFAULT_BLOCKING_RULES
		},
		select: { id: true }
	})
}

export async function getOwnedEvaluation({ ownerId, id }: { ownerId: string; id: string }) {
	const evaluation = await db.evaluation.findFirst({ where: { id, ownerId, kind: 'live' } })
	if (evaluation == null) throw evaluationNotFound()
	return evaluation
}

export async function updateEvaluationConfig({
	ownerId,
	evaluationId,
	identitySame,
	identityDifferent,
	countryCode,
	jevFields,
	blockingRules
}: {
	ownerId: string
	evaluationId: string
	identitySame: string
	identityDifferent: string
	countryCode: string
	jevFields: string[]
	blockingRules: Array<z.infer<typeof blockingRuleSchema>>
}) {
	await getOwnedEvaluation({ ownerId, id: evaluationId })
	await db.evaluation.update({
		where: { id: evaluationId },
		data: { identitySame, identityDifferent, countryCode, jevFields, blockingRules }
	})
}
