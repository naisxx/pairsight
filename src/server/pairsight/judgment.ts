import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { DecisionRequest, TypesafeFailureKind } from '@/server/ai/typesafe'
import type { TrackedModel } from '@/server/lib/ai-usage/models'
import { ENTITY_CONFIG, type EntityType } from '@/lib/pairsight/entity-types'
import type { IdentityRole } from './fields'
import type { MappedFields } from './normalize'

// How one pair is put to Jev, and how its answer is read. Jev receives only
// the two records' mapped identity fields, the user's definition of "same
// individual" and the country — never record references, vendor names,
// vendor scores or vendor decisions (docs/PairSight-V1-Scope.md, "Jev").

// Pinned, so a model change can only happen deliberately (and then means a
// new run, via the judgment key). Verified live 2026-10-01: TypeSafe accepts
// `jev-1.13.0` and reports it back; `jev-1.13` is rejected as unknown. The
// model each response reports is still stored per assessment.
export const JEV_MODEL: TrackedModel = 'jev-1.13.0'
export const JEV_FEATURE = 'pairsight_pair_judgment'

// Bump when the request shape or wording changes: it is part of the judgment
// key, so earlier assessments stop being reused. The question itself comes
// from the entity type (src/lib/pairsight/entity-types.ts).
export const REQUEST_TEMPLATE_VERSION = 1

export type IdentityDefinition = { same: string; different: string }

// A person's default definition; each type has its own (defaultIdentity).
export const DEFAULT_IDENTITY: IdentityDefinition = ENTITY_CONFIG.person.identity

export function defaultIdentity(type: EntityType): IdentityDefinition {
	return ENTITY_CONFIG[type].identity
}

export type JudgmentConfig = {
	entityType: EntityType
	identity: IdentityDefinition
	jevFields: IdentityRole[]
	country: string
	model: TrackedModel
}

// Identical records + an identical judgment config = a reusable assessment.
// The threshold is deliberately absent: changing it only re-decides. A
// person's key leaves the type out, so it is exactly the key people had
// before other types existed and their earlier judgments stay reusable.
export function judgmentKey(config: JudgmentConfig): string {
	const canonical = JSON.stringify({
		version: REQUEST_TEMPLATE_VERSION,
		...(config.entityType === 'person' ? {} : { entityType: config.entityType }),
		identity: config.identity,
		jevFields: [...config.jevFields].sort(),
		country: config.country.toUpperCase(),
		model: config.model
	})
	return createHash('sha256').update(canonical).digest('hex')
}

function recordState(fields: MappedFields, jevFields: IdentityRole[]): Record<string, string> {
	return Object.fromEntries(
		jevFields.flatMap((role) => {
			const value = fields[role]?.trim()
			return value == null || value === '' ? [] : [[role, value]]
		})
	)
}

export function buildJevRequest({
	recordA,
	recordB,
	config
}: {
	recordA: MappedFields
	recordB: MappedFields
	config: JudgmentConfig
}): DecisionRequest {
	const { question } = ENTITY_CONFIG[config.entityType]
	return {
		state: {
			record_1: recordState(recordA, config.jevFields),
			record_2: recordState(recordB, config.jevFields),
			country: config.country.toUpperCase()
		},
		questions: {
			[question.id]: {
				type: 'noul',
				instructions: question.instructions,
				criteria: { true: config.identity.same, false: config.identity.different }
			}
		}
	}
}

const answerSchema = z.object({
	model: z.string().optional(),
	answers: z.record(
		z.string(),
		z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) }).optional()
	)
})

export type JevAnswer =
	| { ok: true; score: number; modelReported: string | null }
	| { ok: false; code: 'invalid_response' }

// A response without a documented `noul` in [0, 1] for the question asked
// (the entity type's) is a failed evaluation, never a guessed score.
export function parseJevAnswer(body: unknown, entityType: EntityType): JevAnswer {
	const parsed = answerSchema.safeParse(body)
	const answer = parsed.success
		? parsed.data.answers[ENTITY_CONFIG[entityType].question.id]
		: undefined
	if (!parsed.success || answer == null) return { ok: false, code: 'invalid_response' }
	return { ok: true, score: answer.noul, modelReported: parsed.data.model ?? null }
}

export type FailureAction = 'retry' | 'fail' | 'stop_run'

// 429 and 529 are documented as retryable with backoff; other 5xx, timeouts
// and network errors are treated the same. A config problem (missing or
// rejected key) stops the run: no pair can succeed until it's fixed.
export function classifyFailure({
	kind,
	status
}: {
	kind: TypesafeFailureKind
	status?: number
}): FailureAction {
	if (kind === 'config') return 'stop_run'
	if (kind === 'timeout' || kind === 'network') return 'retry'
	if (status === 429 || (status != null && status >= 500)) return 'retry'
	return 'fail'
}
