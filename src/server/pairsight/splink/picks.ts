import 'server-only'
import { z } from 'zod'
import { env } from '@/lib/env'
import { db, Prisma } from '@/server/db/client'
import { LIMITS } from '../limits'
import type { CanonicalPair } from '../pairs'
import { SPLINK_PLAN_FLOOR } from './floor'
import { isSuggestionReason, type SuggestionReason } from './reasons'

// The pairs Splink picked for a dataset, for the Plan (plan.ts): those it
// scored at or above the floor, best first. One indexed read of
// `pair_scores`. They're the pairs PairSight checks, with every vendor pair
// added; Splink only picks them, Jev still judges every one.

export type SplinkState = 'waiting' | 'done' | 'skipped' | 'failed'

export type SplinkPicks = {
	state: SplinkState
	pairs: CanonicalPair[]
	// Why it was skipped (too few records, or not set up on this server),
	// when it was.
	reason: SkipReason | null
	// Of the pairs it suggests, how many share each reason, most common first
	// (worked out once when the dataset was scored).
	suggested: number
	reasons: Array<{ reason: SuggestionReason; count: number }>
}

const tallySchema = z.array(z.object({ reason: z.string(), count: z.number().int() }))

function reasonTally(summary: unknown): SplinkPicks['reasons'] {
	if (typeof summary !== 'object' || summary == null || !('reasons' in summary)) return []
	const parsed = tallySchema.safeParse(summary.reasons)
	if (!parsed.success) return []
	return parsed.data.flatMap(({ reason, count }) =>
		isSuggestionReason(reason) ? [{ reason, count }] : []
	)
}

const REASONS = ['too_few_records', 'not_set_up'] as const
export type SkipReason = (typeof REASONS)[number]

function skipReason(summary: unknown): SkipReason | null {
	if (typeof summary !== 'object' || summary == null || !('skipped' in summary)) return null
	const reason = summary.skipped
	return REASONS.find((known) => known === reason) ?? null
}

export async function splinkPicks(datasetId: string): Promise<SplinkPicks> {
	const none = (state: SplinkState, reason: SkipReason | null = null): SplinkPicks => ({
		state,
		pairs: [],
		reason,
		suggested: 0,
		reasons: []
	})
	const dataset = await db.sourceDataset.findUniqueOrThrow({
		where: { id: datasetId },
		select: { scoreStatus: true, scoreSummary: true }
	})
	switch (dataset.scoreStatus) {
		case null:
			// Saved before Splink: asked for now, by the first plan that wants it.
			await db.sourceDataset.updateMany({
				where: { id: datasetId, scoreStatus: null },
				data: { scoreStatus: 'pending', scorePool: env.RUN_WORKER_POOL }
			})
			return none('waiting')
		case 'pending':
		case 'running':
			return none('waiting')
		case 'skipped':
			return none('skipped', skipReason(dataset.scoreSummary))
		case 'failed':
			return none('failed')
		case 'done': {
			const rows = await db.pairScore.findMany({
				where: { datasetId, matchWeight: { gte: SPLINK_PLAN_FLOOR } },
				orderBy: { matchWeight: 'desc' },
				take: LIMITS.maxPairsPerRun,
				select: { recordAId: true, recordBId: true }
			})
			return {
				state: 'done',
				pairs: rows.map((row) => ({ a: row.recordAId, b: row.recordBId })),
				reason: null,
				suggested: rows.length,
				reasons: reasonTally(dataset.scoreSummary)
			}
		}
	}
}

// Scores the dataset again: when its suggestions failed or the service
// wasn't set up, and someone asks to try again. Only a finished job is
// re-queued, so one already waiting or running is left alone.
export async function retrySplink(datasetId: string): Promise<void> {
	await db.sourceDataset.updateMany({
		where: { id: datasetId, scoreStatus: { in: ['failed', 'skipped'] } },
		data: {
			scoreStatus: 'pending',
			scorePool: env.RUN_WORKER_POOL,
			scoreClaimedAt: null,
			scoreSummary: Prisma.DbNull
		}
	})
}

// Why PairSight suggested one pair: its reasons, for the pair page. One
// lookup by the table's key. Empty when it wasn't suggested, or was scored
// before reasons were kept.
export async function suggestionReasons({
	datasetId,
	recordAId,
	recordBId
}: {
	datasetId: string
	recordAId: string
	recordBId: string
}): Promise<SuggestionReason[]> {
	const [a, b] = recordAId < recordBId ? [recordAId, recordBId] : [recordBId, recordAId]
	const row = await db.pairScore.findUnique({
		where: { datasetId_recordAId_recordBId: { datasetId, recordAId: a, recordBId: b } },
		select: { reasons: true }
	})
	return (row?.reasons ?? []).filter(isSuggestionReason)
}
