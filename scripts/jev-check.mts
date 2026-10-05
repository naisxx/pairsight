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

import { PAIRS, TYPE_PAIRS } from './jev-check-pairs.mts'
import { BASE, callJev, db, JEV_MODEL, type Pair } from './jev-client.mts'
import type { EntityType } from '../src/lib/pairsight/entity-types.ts'

const REPEATS = 3
const BURST = 4
const FEATURE = 'pairsight_jev_check'

function call(model: 'jev-latest' | typeof JEV_MODEL, pair: Pair, entityType?: EntityType) {
	return callJev({ model, pair, entityType, feature: FEATURE })
}

console.log(`TypeSafe endpoint: ${BASE}/systemone\n`)

// Organisations and products only, each with its own question and default
// definition: does the 0.50 threshold hold for them too?
if (process.argv.includes('--types')) {
	for (const type of ['company', 'product'] as const) {
		console.log(`${type === 'company' ? 'Organisations' : 'Products'} (pinned ${JEV_MODEL})`)
		for (const pair of TYPE_PAIRS.filter((candidate) => candidate.type === type)) {
			const result = await call(JEV_MODEL, pair, type)
			const score = result.answer?.ok
				? result.answer.score.toFixed(3)
				: `failed (HTTP ${result.status})`
			console.log(
				`   ${score.padEnd(8)} expected ${pair.expect.padEnd(6)} ${pair.label} · ${result.latencyMs} ms`
			)
		}
	}
	await db.$disconnect()
	console.log('\nDone. Every call above was recorded in ai_usage (feature pairsight_jev_check).')
	process.exit(0)
}

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
