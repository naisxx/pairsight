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

// What a failed Jev call means for its pair (docs/PairSight-Scale-Roadmap.md,
// item 4). Only `fail` ever fails a pair, and only for a pair Jev read and
// refused:
// - `wait`: Jev is busy, down, slow or unreachable, or the answer got lost
//   on the way. The pair waits and is tried again later, as often as it
//   takes; the worker slows down as a whole. Never a failure.
// - `access`: the key is missing, rejected or forbidden. Tried a few times
//   (a gateway can blip), then the run stops for someone to fix the key.
// - `fail`: Jev read the request and refused this pair (400, 413, 422).
export type FailureAction = 'wait' | 'access' | 'fail'

const BAD_PAIR_STATUSES: ReadonlySet<number> = new Set([400, 413, 422])

export function classifyFailure({
	kind,
	status
}: {
	kind: TypesafeFailureKind
	status?: number
}): FailureAction {
	if (kind === 'config') return 'access'
	if (kind === 'http' && status != null && BAD_PAIR_STATUSES.has(status)) return 'fail'
	// 429, 408, 409, every 5xx (529 included), timeouts, dropped connections,
	// a body cut off or not JSON, and any status Jev doesn't document: wait.
	return 'wait'
}

// How long a pair waits before Jev is asked again after a busy answer: 2 s,
// 4 s, 8 s… by how often it has been tried, capped at 2 minutes, never
// sooner than Jev asked (Retry-After). Jittered down to half, so pairs
// released together don't all come back in the same second.
const WAIT_FIRST_MS = 2_000
const WAIT_MAX_MS = 120_000
// Doubling stops here, long past the cap, so a pair tried thousands of times
// never overflows the arithmetic.
const MAX_DOUBLINGS = 16

export function waitBeforeRetryMs({
	attempts,
	retryAfterMs,
	random = Math.random
}: {
	attempts: number
	retryAfterMs: number | null
	random?: () => number
}): number {
	const exponent = Math.max(0, attempts - 1)
	const full = Math.min(WAIT_MAX_MS, WAIT_FIRST_MS * 2 ** Math.min(exponent, MAX_DOUBLINGS))
	const jittered = Math.round(full * (0.5 + random() / 2))
	return Math.max(jittered, retryAfterMs ?? 0)
}
