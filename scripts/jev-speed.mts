// How fast can a run go? Sends fictional pairs to the live Jev API at a few
// levels of calls-at-once and reports, for each, the pairs checked per
// second, latency, and any rate limiting (429) or overload (529). Stops
// raising the level once Jev starts pushing back. Sets the run engine's
// concurrency (docs/PairSight-Scale-Roadmap.md, items 0 and 4).
//
// Usage: pnpm jev:speed              (levels 4, 10, 20, 40)
//        pnpm jev:speed 4 8 16      (your own levels)
//
// A few hundred calls in all, about a cent at the stand-in rate. Every call
// is recorded in ai_usage (feature `pairsight_jev_speed`). Fictional records
// only; prints timings and counts, never record contents or the key.

import { PAIRS } from './jev-check-pairs.mts'
import { callJev, db, JEV_MODEL } from './jev-client.mts'

const DEFAULT_LEVELS = [4, 10, 20, 40]
// Enough calls per level for steady timings: at least 40, or 5 rounds.
const MIN_CALLS = 40
const ROUNDS = 5
// Stop raising the level once this share of calls is pushed back.
const PUSHBACK_LIMIT = 0.1
const MS_PER_S = 1000
const MICRO = 1_000_000
const PERCENT = 100
const P50 = 0.5
const P95 = 0.95

type Result = Awaited<ReturnType<typeof callJev>>

function percentile(sorted: number[], share: number): number {
	if (sorted.length === 0) return 0
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0
}

async function runLevel(level: number): Promise<{ results: Result[]; wallMs: number }> {
	const total = Math.max(MIN_CALLS, level * ROUNDS)
	const results: Result[] = []
	let next = 0
	const started = Date.now()
	await Promise.all(
		Array.from({ length: level }, async () => {
			while (next < total) {
				const pair = PAIRS[next % PAIRS.length]
				next++
				if (pair == null) continue
				results.push(await callJev({ model: JEV_MODEL, pair, feature: 'pairsight_jev_speed' }))
			}
		})
	)
	return { results, wallMs: Date.now() - started }
}

const levels = process.argv
	.slice(2)
	.map(Number)
	.filter((value) => Number.isInteger(value) && value > 0)
const plan = levels.length > 0 ? levels : DEFAULT_LEVELS

console.log(`Jev speed test · ${JEV_MODEL} · levels ${plan.join(', ')}\n`)
console.log('at once   calls   ok    429   529   other   pairs/s   p50 ms   p95 ms   cost')
let totalCost = 0
for (const level of plan) {
	const { results, wallMs } = await runLevel(level)
	const ok = results.filter((r) => r.status >= 200 && r.status < 300)
	const limited = results.filter((r) => r.status === 429).length
	const overloaded = results.filter((r) => r.status === 529).length
	const other = results.length - ok.length - limited - overloaded
	const latencies = ok.map((r) => r.latencyMs).sort((a, b) => a - b)
	const cost = results.reduce((sum, r) => sum + (r.costMicroUsd ?? 0), 0)
	totalCost += cost
	const perSecond = ok.length / (wallMs / MS_PER_S)
	console.log(
		[
			String(level).padEnd(9),
			String(results.length).padEnd(7),
			String(ok.length).padEnd(5),
			String(limited).padEnd(5),
			String(overloaded).padEnd(5),
			String(other).padEnd(7),
			perSecond.toFixed(1).padEnd(9),
			String(percentile(latencies, P50)).padEnd(8),
			String(percentile(latencies, P95)).padEnd(8),
			`$${(cost / MICRO).toFixed(4)}`
		].join(' ')
	)
	const pushback = (limited + overloaded) / Math.max(1, results.length)
	if (pushback >= PUSHBACK_LIMIT) {
		console.log(
			`\nStopped: ${(pushback * PERCENT).toFixed(0)}% of calls were pushed back at ${level} at once.`
		)
		break
	}
}

await db.$disconnect()
console.log(
	`\nTotal cost about $${(totalCost / MICRO).toFixed(4)} at the stand-in rate. Every call was recorded in ai_usage (feature pairsight_jev_speed).`
)
