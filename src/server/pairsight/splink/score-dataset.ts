import 'server-only'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { env } from '@/lib/env'
import { captureError } from '@/lib/observability/capture-error'
import { entityTypeOf } from '@/lib/pairsight/entity-types'
import { db, type Prisma } from '@/server/db/client'
import { log as rootLog } from '@/server/lib/logger'
import { loadBlockingRecords } from '../blocking-records'
import { chunks } from '../chunks'
import { LIMITS } from '../limits'
import { SPLINK_PLAN_FLOOR } from './picks'
import { parseReasons, tallyReasons, type SuggestionReason } from './reasons'
import { splinkRecordLines } from './records'
import { runSplink, splinkPython, type SplinkSummary } from './service'

// One dataset scored by Splink, as a background job of the run worker
// (worker/run-worker.ts). The dataset row is the job: `scoreStatus` pending
// → running (claimed) → done, skipped or failed. Its pairs go to
// `pair_scores`, for the Plan (picks.ts). Never blocks anything: a dataset
// Splink can't score just plans with rules and vendor pairs.

const log = rootLog.child({ source: 'splink' })
// A claim older than the service's own time limit, with room to spare, was
// abandoned (a crash or a restart mid-job) and is taken again.
const CLAIM_MARGIN_MS = 60_000
const INSERT_BATCH = 5_000
// Writing a run's worth of pairs takes seconds; this leaves plenty.
const STORE_TIMEOUT_MS = 120_000

function staleBefore(): Date {
	return new Date(Date.now() - env.SPLINK_TIMEOUT_MS - CLAIM_MARGIN_MS)
}

// The oldest dataset waiting to be scored, claimed for this server; null when
// there's none (or another server got it first).
export async function claimDatasetToScore(): Promise<string | null> {
	const waiting = {
		scorePool: env.RUN_WORKER_POOL,
		OR: [
			{ scoreStatus: 'pending' as const },
			{ scoreStatus: 'running' as const, scoreClaimedAt: { lt: staleBefore() } }
		]
	}
	const next = await db.sourceDataset.findFirst({
		where: waiting,
		orderBy: { createdAt: 'asc' },
		select: { id: true }
	})
	if (next == null) return null
	const { count } = await db.sourceDataset.updateMany({
		where: { id: next.id, ...waiting },
		data: { scoreStatus: 'running', scoreClaimedAt: new Date() }
	})
	return count === 1 ? next.id : null
}

async function finish(
	datasetId: string,
	status: 'done' | 'skipped' | 'failed',
	summary: Prisma.InputJsonObject
) {
	await db.sourceDataset.updateMany({
		where: { id: datasetId, scoreStatus: 'running' },
		data: { scoreStatus: status, scoredAt: new Date(), scoreSummary: summary }
	})
}

// The pairs file the service wrote: `a,b,match_weight,match_probability`,
// record ids in canonical order, no quoting (ids are UUIDs).
async function* readPairs(file: string) {
	const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity })
	let isHeader = true
	for await (const line of lines) {
		if (isHeader) {
			isHeader = false
			continue
		}
		const [a, b, weight, probability, reasons = ''] = line.split(',')
		if (a == null || b == null || a === '' || b === '') continue
		yield {
			a,
			b,
			matchWeight: Number(weight),
			matchProbability: Number(probability),
			reasons: parseReasons(reasons)
		}
	}
}

type ScoredPair = {
	a: string
	b: string
	matchWeight: number
	matchProbability: number
	reasons: SuggestionReason[]
}

async function storePairs(datasetId: string, file: string) {
	const pairs: ScoredPair[] = []
	for await (const pair of readPairs(file)) pairs.push(pair)
	await db.$transaction(
		async (tx) => {
			await tx.pairScore.deleteMany({ where: { datasetId } })
			for (const batch of chunks(pairs, INSERT_BATCH)) {
				await tx.pairScore.createMany({
					data: batch.map((pair) => ({
						datasetId,
						recordAId: pair.a,
						recordBId: pair.b,
						matchWeight: pair.matchWeight,
						matchProbability: pair.matchProbability,
						reasons: pair.reasons
					}))
				})
			}
		},
		{ timeout: STORE_TIMEOUT_MS }
	)
	// What the suggested pairs have in common, counted once here so a page
	// never reads every pair to say it (the Rules screen's "most share…").
	const suggested = pairs.filter((pair) => pair.matchWeight >= SPLINK_PLAN_FLOOR)
	return {
		stored: pairs.length,
		suggested: suggested.length,
		reasons: tallyReasons(suggested)
	}
}

export async function scoreDataset(datasetId: string): Promise<void> {
	const dataset = await db.sourceDataset.findUniqueOrThrow({
		where: { id: datasetId },
		select: { evaluation: { select: { entityType: true, countryCode: true } } }
	})
	const entityType = entityTypeOf(dataset.evaluation.entityType)
	const python = splinkPython()
	if (python == null) {
		await finish(datasetId, 'skipped', { skipped: 'not_set_up' })
		return
	}
	const folder = await mkdtemp(path.join(tmpdir(), 'pairsight-splink-'))
	try {
		const recordsPath = path.join(folder, 'records.csv')
		const outPath = path.join(folder, 'pairs.csv')
		const records = await loadBlockingRecords(datasetId)
		await pipeline(
			Readable.from(
				splinkRecordLines(records, { type: entityType, country: dataset.evaluation.countryCode })
			),
			createWriteStream(recordsPath)
		)
		const summary: SplinkSummary = await runSplink({
			python,
			entityType,
			recordsPath,
			outPath,
			maxPairs: LIMITS.maxPairsPerRun
		})
		if (summary.skipped != null) {
			await finish(datasetId, 'skipped', summary)
			return
		}
		const stored = await storePairs(datasetId, outPath)
		await finish(datasetId, 'done', {
			...summary,
			pairs_stored: stored.stored,
			pairs_suggested: stored.suggested,
			reasons: stored.reasons
		})
		log.info('dataset scored', {
			datasetId,
			pairs: stored.stored,
			seconds: summary.seconds_total
		})
	} catch (error) {
		const kind = error instanceof Error ? error.name : 'unknown'
		log.error('dataset scoring failed', { datasetId, kind })
		captureError(error, { datasetId, source: 'splink' })
		await finish(datasetId, 'failed', { failed: kind }).catch(() => undefined)
	} finally {
		await rm(folder, { recursive: true, force: true })
	}
}
