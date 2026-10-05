// One live call to TypeSafe's Jev, for the scripts that measure it
// (jev-check.mts, jev-speed.mts). Builds the same request the app sends,
// records the call in ai_usage like the app's own calls (priced at the
// stand-in rate), and returns the timing and the parsed answer. Fictional
// records only; nothing here prints record contents or the key.

import { PrismaClient } from '@prisma/client'
import {
	buildJevRequest,
	defaultIdentity,
	JEV_MODEL,
	parseJevAnswer,
	type JudgmentConfig
} from '../src/server/pairsight/judgment.ts'
import { costMicroUsd, fetchRateCard } from '../src/server/lib/ai-usage/pricing.ts'
import { openRouterSlug } from '../src/server/lib/ai-usage/models.ts'
import { buildRow } from '../src/server/lib/ai-usage/track.ts'
import type { EntityType } from '../src/lib/pairsight/entity-types.ts'
import type { IdentityRole } from '../src/server/pairsight/fields.ts'

export { JEV_MODEL }

export const BASE = process.env.TYPESAFE_API_BASE_URL || 'https://api.typesafe.ai/v1'
const KEY = process.env.TYPESAFE_API_KEY
const TIMEOUT_MS = 20_000

if (KEY == null || KEY === '') {
	console.error('TYPESAFE_API_KEY is not set. Add it to .env.local, then run this again.')
	process.exit(1)
}

export const db = new PrismaClient()
const rates = await fetchRateCard().catch(() => undefined)

const PERSON_FIELDS: JudgmentConfig['jevFields'] = [
	'first_name',
	'last_name',
	'email',
	'phone',
	'date_of_birth',
	'address',
	'postcode'
]

export type Pair = { a: Record<string, string>; b: Record<string, string> }

function isRole(field: string): field is IdentityRole {
	return field !== 'other'
}

export async function callJev({
	model,
	pair,
	entityType = 'person',
	feature
}: {
	model: 'jev-latest' | typeof JEV_MODEL
	pair: Pair
	entityType?: EntityType
	// The ai_usage feature the call is recorded under.
	feature: string
}) {
	const config: JudgmentConfig = {
		entityType,
		identity: defaultIdentity(entityType),
		jevFields:
			entityType === 'person'
				? PERSON_FIELDS
				: [...new Set([...Object.keys(pair.a), ...Object.keys(pair.b)])].filter(isRole),
		country: 'US',
		model
	}
	const request = buildJevRequest({ recordA: pair.a, recordB: pair.b, config })
	const started = Date.now()
	let status = 0
	let body: unknown = null
	try {
		const response = await fetch(`${BASE}/systemone`, {
			method: 'POST',
			headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
			body: JSON.stringify({ model, ...request }),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		})
		status = response.status
		body = response.ok ? await response.json() : null
	} catch {
		// A timeout or dropped connection: status 0, recorded as an error.
	}
	const latencyMs = Date.now() - started
	const ok = status >= 200 && status < 300
	const row = buildRow({ provider: 'typesafe', feature, model }, body, {
		status: ok ? 'ok' : 'error',
		latencyMs
	})
	const slug = openRouterSlug(row.model)
	const cost = slug == null ? null : costMicroUsd(row, rates?.get(slug))
	await db.aiUsage.create({
		data: {
			provider: row.provider,
			model: slug ?? row.model,
			serviceTier: row.serviceTier,
			feature: row.feature,
			inputTokens: row.inputTokens,
			outputTokens: row.outputTokens,
			cacheWriteTokens: 0,
			cacheReadTokens: 0,
			costMicroUsd: cost == null ? null : BigInt(cost),
			status: row.status,
			latencyMs: row.latencyMs
		}
	})
	const answer = ok ? parseJevAnswer(body, entityType) : null
	const keys = body != null && typeof body === 'object' ? Object.keys(body).join(',') : '—'
	return { status, latencyMs, answer, keys, tokens: row.inputTokens, costMicroUsd: cost }
}
