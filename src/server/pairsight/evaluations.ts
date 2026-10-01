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

// Names are unique per owner, ignoring case, so the dashboard and the
// sidebar never show two evaluations you can't tell apart. Renaming one to
// its own name (or a new casing of it) is fine.
async function assertNameFree({
	ownerId,
	name,
	exceptId
}: {
	ownerId: string
	name: string
	exceptId?: string
}) {
	const taken = await db.evaluation.findFirst({
		where: {
			ownerId,
			kind: 'live',
			name: { equals: name, mode: 'insensitive' },
			...(exceptId == null ? {} : { id: { not: exceptId } })
		},
		select: { id: true }
	})
	if (taken != null) {
		throw new AppError('An evaluation with this name already exists.', {
			status: 409,
			code: 'name_taken'
		})
	}
}

export async function createEvaluation({ ownerId, name }: { ownerId: string; name: string }) {
	await assertNameFree({ ownerId, name })
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

export async function renameEvaluation({
	ownerId,
	evaluationId,
	name
}: {
	ownerId: string
	evaluationId: string
	name: string
}) {
	await getOwnedEvaluation({ ownerId, id: evaluationId })
	await assertNameFree({ ownerId, name, exceptId: evaluationId })
	await db.evaluation.update({ where: { id: evaluationId }, data: { name } })
}

// Everything under it (uploads, runs, judgments) goes with it by cascade.
export async function deleteEvaluation({
	ownerId,
	evaluationId
}: {
	ownerId: string
	evaluationId: string
}) {
	await getOwnedEvaluation({ ownerId, id: evaluationId })
	await db.evaluation.delete({ where: { id: evaluationId } })
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
