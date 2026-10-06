import 'server-only'
import { z } from 'zod'
import { env } from '@/lib/env'
import { db } from '@/server/db/client'
import { LIMITS } from '../limits'
import type { CanonicalPair } from '../pairs'
import { isSuggestionReason, type SuggestionReason } from './reasons'

// The pairs Splink picked for a dataset, for the Plan (plan.ts): those it
// scored at or above the floor, best first. One indexed read of
// `pair_scores`. Splink only picks pairs; Jev still judges every one.

// The match weight a pair needs to be picked. On the benchmark
// (scripts/splink-spike/, docs/PairSight-Scale-Roadmap.md item 5), pairs at
// or above 0 held about 90% of the planted duplicates at 10K and 100K
// records, at a fraction of the pairs the close-match rules need.
export const SPLINK_PLAN_FLOOR = 0

export type SplinkState = 'off' | 'waiting' | 'done' | 'skipped' | 'failed'

export type SplinkPicks = {
	state: SplinkState
	pairs: CanonicalPair[]
	// Why it was skipped (too few records, a type it doesn't do yet, or not
	// set up on this server), when it was.
	reason: string | null
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

const REASONS = ['too_few_records', 'not_people', 'not_set_up'] as const
export type SkipReason = (typeof REASONS)[number]

function skipReason(summary: unknown): SkipReason | null {
	if (typeof summary !== 'object' || summary == null || !('skipped' in summary)) return null
	const reason = summary.skipped
	return REASONS.find((known) => known === reason) ?? null
}

export async function splinkPicks({
	datasetId,
	isOn
}: {
	datasetId: string
	isOn: boolean
}): Promise<SplinkPicks> {
	const none = (state: SplinkState, reason: string | null = null): SplinkPicks => ({
		state,
		pairs: [],
		reason,
		suggested: 0,
		reasons: []
	})
	if (!isOn) return none('off')
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
