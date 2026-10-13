import 'server-only'
import type { JevCredentials } from '@/server/ai/jev-credentials'
import { requestDecision, TypesafeError, type TypesafeFailureKind } from '@/server/ai/typesafe'
import { buildJevRequest, DEFAULT_IDENTITY, JEV_MODEL, parseJevAnswer } from './judgment'

// Proves a Jev key works before Settings saves it: Jev is asked about one
// made-up pair, through the same tracked call a run makes, so the check is
// costed like any other (feature below). Only fictional values are sent.
export const KEY_CHECK_FEATURE = 'pairsight_jev_key_check'

const CHECK_PAIR = {
	recordA: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada.lovelace@example.com' },
	recordB: { first_name: 'Ada', last_name: 'Lovelace', email: 'a.lovelace@example.com' }
}

export type KeyCheckFailure = 'refused' | 'unreachable' | 'unexpected'
export type KeyCheck = { ok: true } | { ok: false; reason: KeyCheckFailure }

// What a failed check tells the admin: the key is wrong, the address can't
// be reached, or Jev answered with something else.
export function keyCheckFailure({ kind }: { kind: TypesafeFailureKind }): KeyCheckFailure {
	if (kind === 'config') return 'refused'
	if (kind === 'network' || kind === 'timeout') return 'unreachable'
	return 'unexpected'
}

export async function checkJevKey(credentials: JevCredentials): Promise<KeyCheck> {
	const request = buildJevRequest({
		...CHECK_PAIR,
		config: {
			entityType: 'person',
			identity: DEFAULT_IDENTITY,
			jevFields: ['first_name', 'last_name', 'email'],
			country: 'GB',
			model: JEV_MODEL
		}
	})
	try {
		const body = await requestDecision(
			{ feature: KEY_CHECK_FEATURE, model: JEV_MODEL },
			request,
			credentials
		)
		return parseJevAnswer(body, 'person').ok ? { ok: true } : { ok: false, reason: 'unexpected' }
	} catch (error) {
		if (error instanceof TypesafeError) return { ok: false, reason: keyCheckFailure(error) }
		throw error
	}
}
