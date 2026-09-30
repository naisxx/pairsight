// Live integration check against TypeSafe's real Jev API
// (docs/PairSight-Delivery-Plan.md, M1). Answers what the docs leave open:
// does a pinned model work, what does a response carry, how long does a call
// take, do repeated calls agree, and do concurrent calls hit 429 — and gives
// scores for fictional pairs to set the default threshold from.
//
// Usage: pnpm jev:check   (reads TYPESAFE_API_KEY from .env.local / .env)
//
// Fictional records only. Prints pair labels, scores and timings — never
// record contents or the key. Every call is recorded in ai_usage like the
// app's own calls (feature `pairsight_jev_check`), priced at the stand-in rate.

import { PrismaClient } from '@prisma/client'
import {
	buildJevRequest,
	DEFAULT_IDENTITY,
	JEV_MODEL,
	parseJevAnswer,
	type JudgmentConfig
} from '../src/server/pairsight/judgment.ts'
import { costMicroUsd, fetchRateCard } from '../src/server/lib/ai-usage/pricing.ts'
import { openRouterSlug } from '../src/server/lib/ai-usage/models.ts'
import { buildRow } from '../src/server/lib/ai-usage/track.ts'
import { PAIRS } from './jev-check-pairs.mts'

const BASE = process.env.TYPESAFE_API_BASE_URL || 'https://api.typesafe.ai/v1'
const KEY = process.env.TYPESAFE_API_KEY
const REPEATS = 3
const BURST = 4

if (KEY == null || KEY === '') {
	console.error('TYPESAFE_API_KEY is not set. Add it to .env.local, then run this again.')
	process.exit(1)
}

const db = new PrismaClient()
const rates = await fetchRateCard().catch(() => undefined)

const FIELDS: JudgmentConfig['jevFields'] = [
	'first_name',
	'last_name',
	'email',
	'phone',
	'date_of_birth',
	'address',
	'postcode'
]

async function call(model: 'jev-latest' | typeof JEV_MODEL, pair: (typeof PAIRS)[number]) {
	const config: JudgmentConfig = {
		identity: DEFAULT_IDENTITY,
		jevFields: FIELDS,
		country: 'US',
		model
	}
	const request = buildJevRequest({ recordA: pair.a, recordB: pair.b, config })
	const started = Date.now()
	const response = await fetch(`${BASE}/systemone`, {
		method: 'POST',
		headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
		body: JSON.stringify({ model, ...request }),
		signal: AbortSignal.timeout(20_000)
	})
	const latencyMs = Date.now() - started
	const body: unknown = response.ok ? await response.json() : null
	const row = buildRow({ provider: 'typesafe', feature: 'pairsight_jev_check', model }, body, {
		status: response.ok ? 'ok' : 'error',
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
	const answer = response.ok ? parseJevAnswer(body) : null
	const keys = body != null && typeof body === 'object' ? Object.keys(body).join(',') : '—'
	return { status: response.status, latencyMs, answer, keys, tokens: row.inputTokens }
}

console.log(`TypeSafe endpoint: ${BASE}/systemone\n`)

console.log(`1. Response shape and model (pinned ${JEV_MODEL}, what the app calls)`)
const first = await call(JEV_MODEL, PAIRS[0])
console.log(
	`   HTTP ${first.status} · ${first.latencyMs} ms · top-level keys: ${first.keys} · ~${first.tokens} input tokens`
)
console.log(`   parsed: ${JSON.stringify(first.answer)}`)
if (first.status === 401) {
	console.error('\nThe key was rejected (401). Check TYPESAFE_API_KEY.')
	process.exit(1)
}

console.log('\n2. Floating alias (jev-latest)')
const pinned = await call('jev-latest', PAIRS[0])
console.log(
	`   HTTP ${pinned.status} · ${pinned.answer?.ok ? `model reported: ${pinned.answer.modelReported}` : 'not accepted or unparseable'}`
)

console.log('\n3. Fictional pairs (for the default threshold)')
for (const pair of PAIRS) {
	const result = await call(JEV_MODEL, pair)
	const score = result.answer?.ok
		? result.answer.score.toFixed(3)
		: `failed (HTTP ${result.status})`
	console.log(
		`   ${score.padEnd(8)} expected ${pair.expect.padEnd(10)} ${pair.label} · ${result.latencyMs} ms`
	)
}

console.log(`\n4. Repeatability (${REPEATS} calls, same pair)`)
const repeats = []
for (let i = 0; i < REPEATS; i++) repeats.push(await call(JEV_MODEL, PAIRS[5]))
const scores = repeats.map((r) => (r.answer?.ok ? r.answer.score : null))
console.log(
	`   scores: ${scores.map((s) => s?.toFixed(4) ?? 'failed').join(', ')} · ${new Set(scores).size === 1 ? 'identical' : 'NOT identical'}`
)

console.log(`\n5. Concurrency (${BURST} calls at once)`)
const burst = await Promise.all(PAIRS.slice(0, BURST).map((pair) => call(JEV_MODEL, pair)))
console.log(
	`   statuses: ${burst.map((r) => r.status).join(', ')} · latencies: ${burst.map((r) => r.latencyMs).join(', ')} ms`
)

await db.$disconnect()
console.log('\nDone. Every call above was recorded in ai_usage (feature pairsight_jev_check).')
