// Pushes a synthetic file of fictional people (scale/people.mts) through
// today's code to see where it strains: the file size against the upload
// limits, reading it, and the comparison rules (pairs, biggest groups,
// planted duplicates found, time). No database and no Jev.
//
// Usage: pnpm scale:measure          (10,000 people)
//        pnpm scale:measure 50000

import { defaultRules, presetsFor } from '../../src/lib/pairsight/entity-types.ts'
import { isFuzzyRule } from '../../src/lib/pairsight/derived-keys.ts'
import { MAX_FILE_BYTES } from '../../src/lib/pairsight/tabular-formats.ts'
import { buildBlockedPairs } from '../../src/server/pairsight/blocking.ts'
import { blockingQuality } from '../../src/server/pairsight/blocking-quality.ts'
import { LIMITS } from '../../src/server/pairsight/limits.ts'
import { readTable } from '../../src/server/pairsight/tabular/index.ts'
import { generatePeople, toCsv, toRecords } from './people.mts'

const DEFAULT_SIZE = 10_000
const COUNTRY = 'GB'
// The server-action body limit in next.config.ts.
const ACTION_BODY_BYTES = 2_000_000
// Pairs a second: today's engine, and what the live speed test reached at
// 40 and 120 calls at once (pnpm jev:speed, 2026-10-05).
const SPEEDS = { today: 10, at40: 97, at120: 277 }
const MB = 1_000_000
const PERCENT = 100
const SECONDS_PER_MINUTE = 60

const size = Number(process.argv[2] ?? DEFAULT_SIZE)
const heapMb = () => (process.memoryUsage().heapUsed / MB).toFixed(0)
const timed = async <T,>(work: () => T | Promise<T>) => {
	const started = performance.now()
	const result = await work()
	return { result, ms: Math.round(performance.now() - started) }
}
const duration = (pairs: number, perSecond: number) => {
	const seconds = pairs / perSecond
	return seconds < SECONDS_PER_MINUTE
		? `${seconds.toFixed(0)} s`
		: `${(seconds / SECONDS_PER_MINUTE).toFixed(1)} min`
}

const { rows, duplicates } = generatePeople(size)
const csv = new TextEncoder().encode(toCsv(rows))
const possible = (size * (size - 1)) / 2
console.log(
	`${size.toLocaleString()} fictional people · ${duplicates.length.toLocaleString()} planted duplicates · ${possible.toLocaleString()} possible pairs\n`
)

console.log('File')
console.log(
	`  size              ${(csv.length / MB).toFixed(2)} MB (upload limit ${MAX_FILE_BYTES / MB} MB, server-action limit ${ACTION_BODY_BYTES / MB} MB)`
)
console.log(
	`  record limit      ${LIMITS.maxSourceRecords.toLocaleString()}: ${size > LIMITS.maxSourceRecords ? 'over today’s limit' : 'within'}`
)
const read = await timed(() => readTable({ fileName: 'people.csv', bytes: csv, maxRows: size + 1 }))
console.log(
	`  reading           ${read.ms} ms · heap ${heapMb()} MB · ${read.result.ok ? `${read.result.table.rows.length.toLocaleString()} rows` : `failed: ${read.result.error.code}`}`
)

const records = toRecords(rows)
const exact = defaultRules('person')
const fuzzy = presetsFor('person')
	.filter(isFuzzyRule)
	.map((preset) => ({ id: preset.id, fields: [...preset.fields] }))

for (const [label, rules] of [
	['Default rules', exact],
	['Default + close-match presets', [...exact, ...fuzzy]]
] as const) {
	const run = await timed(() => buildBlockedPairs({ records, rules, country: COUNTRY }))
	const quality = blockingQuality({ records, rules, duplicates, country: COUNTRY })
	const pairs = run.result.pairs.length
	console.log(`\n${label}`)
	console.log(
		`  pairs to check    ${pairs.toLocaleString()} (cap ${LIMITS.maxPairsPerRun.toLocaleString()}: ${pairs > LIMITS.maxPairsPerRun ? 'OVER' : 'within'})`
	)
	console.log(
		`  duplicates found  ${quality.found.toLocaleString()} of ${quality.known.toLocaleString()} (${(quality.completeness * PERCENT).toFixed(1)}%)`
	)
	console.log(`  blocking time     ${run.ms} ms · heap ${heapMb()} MB`)
	for (const stat of run.result.stats) {
		const warning =
			stat.oversized != null
				? ` · ${stat.oversized.groups} groups over ${LIMITS.bucketWarningSize}`
				: ''
		console.log(
			`    ${stat.ruleId.padEnd(26)} ${stat.pairCount.toLocaleString().padStart(9)} pairs · biggest group ${stat.largestBucket}${warning}`
		)
	}
	console.log(
		`  Jev time          today ${duration(pairs, SPEEDS.today)} · at 40 at once ${duration(pairs, SPEEDS.at40)} · at 120 at once ${duration(pairs, SPEEDS.at120)}`
	)
}
