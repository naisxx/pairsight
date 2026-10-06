// A finished run of any size in the local database, to measure Results at
// scale (docs/PairSight-Scale-Roadmap.md, item 2): fictional people
// (scale/people.mts), their planted duplicates plus random pairs, made-up
// scores and three made-up vendors. No upload and no Jev: it writes the rows
// a finished run would have, then builds the run's summary as the worker
// does, and says how long that took.
//
// Usage: pnpm scale:seed-run                      (200,000 pairs)
//        pnpm scale:seed-run --pairs 1000000
//        pnpm scale:seed-run --email you@example.test
//
// Owned by the account given, or else the local account with the most
// evaluations that isn't an end-to-end test account.

import { randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'
import { defaultRules, presetsFor } from '../../src/lib/pairsight/entity-types.ts'
import { isFuzzyRule } from '../../src/lib/pairsight/derived-keys.ts'
import { db } from '../../src/server/db/client.ts'
import { defaultIdentity, JEV_MODEL, judgmentKey } from '../../src/server/pairsight/judgment.ts'
import { recordKeys } from '../../src/server/pairsight/record-keys.ts'
import {
	buildRunSummary,
	SUMMARY_RUN_SELECT,
	summaryColumns
} from '../../src/server/pairsight/run-summary.ts'
import { generatePeople, HEADERS } from './people.mts'

const DEFAULT_PAIRS = 200_000
// People per pair: enough records that random pairs rarely repeat.
const PAIRS_PER_PERSON = 5
const MIN_PEOPLE = 2_000
// Rows per insert statement.
const BATCH = 5_000
const THRESHOLD = 0.5
const COUNTRY = 'GB'
// Shares of the made-up judgments.
const FAILED_SHARE = 0.01
const PENDING_SHARE = 0
const VENDOR_ONLY_SHARE = 0.02

const { values: options } = parseArgs({
	options: { pairs: { type: 'string' }, email: { type: 'string' } }
})
const pairTarget = Number(options.pairs ?? DEFAULT_PAIRS)
if (!Number.isInteger(pairTarget) || pairTarget < 1)
	throw new Error('--pairs must be a whole number')

// Mulberry32: seeded, and good for millions of draws without repeating.
function random(seed: number) {
	let state = seed >>> 0
	return () => {
		state = (state + 0x6d2b79f5) >>> 0
		let t = state
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
	}
}
const next = random(7)

async function owner(): Promise<string> {
	if (options.email != null) {
		const user = await db.user.findUnique({ where: { email: options.email }, select: { id: true } })
		if (user == null) throw new Error('No local account has that email.')
		return user.id
	}
	const users = await db.user.findMany({
		where: { NOT: { email: { startsWith: 'e2e+' } } },
		select: { id: true }
	})
	const counts = await Promise.all(
		users.map(async (user) => ({
			id: user.id,
			evaluations: await db.evaluation.count({ where: { ownerId: user.id } })
		}))
	)
	const chosen = counts.sort((a, b) => b.evaluations - a.evaluations)[0]
	if (chosen == null)
		throw new Error('No local account to own the run. Sign up first, or pass --email.')
	return chosen.id
}

async function inBatches<T>(rows: T[], write: (batch: T[]) => Promise<unknown>) {
	for (let at = 0; at < rows.length; at += BATCH) await write(rows.slice(at, at + BATCH))
}

const timed = async <T,>(label: string, work: () => Promise<T>) => {
	const started = performance.now()
	const result = await work()
	console.log(`${label}: ${((performance.now() - started) / 1000).toFixed(1)} s`)
	return result
}

const ownerId = await owner()
const people = generatePeople(Math.max(MIN_PEOPLE, Math.ceil(pairTarget / PAIRS_PER_PERSON)))
const columnRoles = Object.fromEntries(
	HEADERS.map((header) => [header, header === 'record_id' ? 'other' : header])
)
const exact = defaultRules('person')
const fuzzy = presetsFor('person')
	.filter(isFuzzyRule)
	.map((preset) => ({ id: preset.id, fields: [...preset.fields] }))
const rules = [...exact, ...fuzzy]
const identity = defaultIdentity('person')
const jevFields = HEADERS.filter((header) => header !== 'record_id')
const key = judgmentKey({
	entityType: 'person',
	identity,
	jevFields: [...jevFields],
	country: COUNTRY,
	model: JEV_MODEL
})

const recordIds = people.rows.map(() => randomUUID())
const idOf = new Map(people.rows.map((row, index) => [row.record_id, recordIds[index] ?? '']))

// The pairs: every planted duplicate, then random people until the target.
type SeedPair = { a: string; b: string; duplicate: 'easy' | 'hard' | null }
const seen = new Set<string>()
const pairs: SeedPair[] = []
const add = (first: string, second: string, duplicate: SeedPair['duplicate']) => {
	const [a, b] = first < second ? [first, second] : [second, first]
	const pairKey = `${a}|${b}`
	if (a === b || seen.has(pairKey) || pairs.length >= pairTarget) return
	seen.add(pairKey)
	pairs.push({ a, b, duplicate })
}
for (const duplicate of people.duplicates) {
	add(
		idOf.get(duplicate.recordA) ?? '',
		idOf.get(duplicate.recordB) ?? '',
		duplicate.kind === 'easy' ? 'easy' : 'hard'
	)
}
while (pairs.length < pairTarget) {
	const pick = () => recordIds[Math.floor(next() * recordIds.length)] ?? ''
	add(pick(), pick(), null)
}

const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T
const scoreFor = (pair: SeedPair) =>
	pair.duplicate == null
		? next() < 0.05
			? 0.35 + next() * 0.3
			: next() * 0.35
		: pair.duplicate === 'easy'
			? 0.8 + next() * 0.2
			: 0.45 + next() * 0.5
// Three vendors: careful (few wrong merges, misses hard duplicates),
// aggressive (finds more, merges more wrongly) and in between.
const vendorRules = {
	Careful: (pair: SeedPair, score: number) =>
		pair.duplicate === 'easy'
			? next() < 0.95
			: pair.duplicate === 'hard'
				? next() < 0.3
				: score > 0.6 && next() < 0.2,
	Aggressive: (pair: SeedPair, score: number) =>
		pair.duplicate != null ? next() < 0.95 : score > 0.3 && next() < 0.4,
	Balanced: (pair: SeedPair, score: number) =>
		pair.duplicate != null ? next() < 0.75 : score > 0.45 && next() < 0.25
}
const vendorIds = Object.keys(vendorRules).map(() => randomUUID())

const rows = pairs.map((pair) => {
	const roll = next()
	const status =
		roll < FAILED_SHARE ? 'failed' : roll < FAILED_SHARE + PENDING_SHARE ? 'pending' : 'succeeded'
	const score = status === 'succeeded' ? Math.round(scoreFor(pair) * 1000) / 1000 : null
	const judgedScore = score ?? 0
	const matchedBy = Object.values(vendorRules).flatMap((decide, index) =>
		decide(pair, judgedScore) ? [vendorIds[index] ?? ''] : []
	)
	const vendorOnly = matchedBy.length > 0 && next() < VENDOR_ONLY_SHARE
	const ruleIds = vendorOnly
		? []
		: pair.duplicate === 'hard'
			? [pick(fuzzy).id]
			: pair.duplicate === 'easy'
				? [pick(exact).id]
				: next() < 0.5
					? [pick(exact).id]
					: [pick(fuzzy).id, ...(next() < 0.3 ? [pick(exact).id] : [])]
	return { ...pair, status, score, matchedBy, ruleIds, assessmentId: randomUUID() }
})

const evaluation = await db.evaluation.create({
	data: {
		ownerId,
		name: `Scale check: ${pairTarget.toLocaleString('en-GB')} pairs`,
		entityType: 'person',
		identitySame: identity.same,
		identityDifferent: identity.different,
		countryCode: COUNTRY,
		jevFields: [...jevFields],
		blockingRules: rules,
		threshold: THRESHOLD
	},
	select: { id: true }
})
const dataset = await db.sourceDataset.create({
	data: {
		evaluationId: evaluation.id,
		fileName: `scale-people-${people.rows.length}.csv`,
		rowCount: people.rows.length,
		referenceColumn: 'record_id',
		columnRoles
	},
	select: { id: true }
})

await timed(`${people.rows.length.toLocaleString('en-GB')} records`, () =>
	inBatches(
		people.rows.map((row, index) => ({ row, index })),
		(batch) =>
			db.sourceRecord.createMany({
				data: batch.map(({ row, index }) => ({
					id: recordIds[index] ?? '',
					datasetId: dataset.id,
					reference: row.record_id,
					rowNumber: index + 2,
					values: row,
					...recordKeys({
						reference: row.record_id,
						values: row,
						columnRoles,
						entityType: 'person'
					})
				}))
			})
	)
)

await timed('vendors', async () => {
	const now = new Date()
	for (const [index, name] of Object.keys(vendorRules).entries()) {
		const id = vendorIds[index] ?? ''
		const matched = rows.filter((row) => row.matchedBy.includes(id))
		await db.vendorExport.create({
			data: {
				id,
				evaluationId: evaluation.id,
				datasetId: dataset.id,
				name,
				format: 'pair',
				fileName: `${name.toLowerCase()}.csv`,
				mapping: { columnA: 'a', columnB: 'b' },
				confirmedCompleteAt: now,
				pairCount: matched.length,
				createdAt: new Date(now.getTime() + index)
			}
		})
		await inBatches(matched, (batch) =>
			db.vendorMatch.createMany({
				data: batch.map((row) => ({ exportId: id, recordAId: row.a, recordBId: row.b }))
			})
		)
	}
})

const completedAt = new Date()
const run = await db.run.create({
	data: {
		evaluationId: evaluation.id,
		datasetId: dataset.id,
		number: 1,
		entityType: 'person',
		status: 'completed',
		identitySame: identity.same,
		identityDifferent: identity.different,
		countryCode: COUNTRY,
		jevFields: [...jevFields],
		blockingRules: rules,
		exportIds: vendorIds,
		judgmentKey: key,
		jevModel: JEV_MODEL,
		threshold: THRESHOLD,
		initialThreshold: THRESHOLD,
		pairCount: rows.length,
		completedAt
	},
	select: SUMMARY_RUN_SELECT
})

await timed(`${rows.length.toLocaleString('en-GB')} pairs and their judgments`, () =>
	inBatches(rows, async (batch) => {
		await db.assessment.createMany({
			data: batch.map((row) => ({
				id: row.assessmentId,
				datasetId: dataset.id,
				recordAId: row.a,
				recordBId: row.b,
				judgmentKey: key,
				status: row.status,
				score: row.score,
				modelReported: row.status === 'succeeded' ? JEV_MODEL : null,
				errorCode: row.status === 'failed' ? 'http_500' : null,
				attempts: 1,
				completedAt: row.status === 'pending' ? null : completedAt
			}))
		})
		await db.runPair.createMany({
			data: batch.map((row) => ({
				runId: run.id,
				recordAId: row.a,
				recordBId: row.b,
				ruleIds: row.ruleIds,
				matchedByExportIds: row.matchedBy,
				assessmentId: row.assessmentId
			}))
		})
	})
)

const summary = await timed('summary (what the worker builds when a run finishes)', () =>
	buildRunSummary(run)
)
await db.run.update({ where: { id: run.id }, data: summaryColumns(summary) })
await db.$disconnect()
console.log(
	`run ${run.id}: open it from the dashboard ("${`Scale check: ${pairTarget.toLocaleString('en-GB')} pairs`}")`
)
