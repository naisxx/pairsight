import 'server-only'
import { cache } from 'react'
import { AppError } from '@/lib/errors/app-error'
import { failureReason, type FailureReason } from '@/lib/pairsight/failure-reasons'
import { captureError } from '@/lib/observability/capture-error'
import { db } from '@/server/db/client'
import { evaluationWhere, ownerScope, scopeKey, type EvaluationScope } from './scope'

// Run lookup, progress, and the mutations after a run starts (retry, resume,
// threshold). Starting a run lives in start-run.ts.

export function runNotFound() {
	return new AppError('That run doesn’t exist, or you don’t have access to it.', {
		status: 404,
		code: 'not_found'
	})
}

// Downloads wait for a finished run: a half-checked run's numbers could point
// the wrong way (pairs aren't checked in any particular order).
export function runNotFinished() {
	return new AppError(
		'This run isn’t finished yet. Its downloads are ready once every pair is checked.',
		{
			status: 409,
			code: 'run_not_finished'
		}
	)
}

// For changes: only a run of the owner's own live evaluation. Never cached:
// a change reads the run as it is now.
export async function getOwnedRun({ ownerId, runId }: { ownerId: string; runId: string }) {
	return findRun(ownerScope(ownerId), runId)
}

async function findRun(scope: EvaluationScope, runId: string) {
	const run = await db.run.findFirst({
		where: { id: runId, evaluation: evaluationWhere(scope) },
		include: { evaluation: { select: { id: true, name: true } } }
	})
	if (run == null) throw runNotFound()
	return run
}

// For reads: a run the scope may see. Read once per request, however many
// parts of a page ask (the results and the pair beside them both do).
export async function getVisibleRun({ scope, runId }: { scope: EvaluationScope; runId: string }) {
	return loadVisibleRun(scopeKey(scope), scope, runId)
}

const loadVisibleRun = cache((_key: string, scope: EvaluationScope, runId: string) =>
	findRun(scope, runId)
)

export type RunProgress = {
	status: 'running' | 'completed' | 'stopped'
	stopReason: string | null
	total: number
	// Pairs without a final answer yet: waiting, or being checked now.
	pending: number
	succeeded: number
	failed: number
	// Failed pairs grouped by why, most common first.
	failures: Array<{ reason: FailureReason; count: number }>
	// When its last pair was checked: set before its results are worked out,
	// so a run can be done checking while still `running` for a few seconds.
	completedAt: Date | null
	// Since when it has been waiting for Jev, busy or down, to answer again;
	// it carries on by itself. Null when it isn't waiting.
	waitingSince: Date | null
}

// A run's counts worked out exactly from its pairs' answers, and stored
// (runs.checkedCount, failedCount). Reads every pair, so only where counts
// can shift other than by a pair being answered: a run starting, a retry, a
// re-check, a run finishing, and a run never counted before.
export async function recountRun(runId: string) {
	const groups = await db.assessment.groupBy({
		by: ['status'],
		where: { runPairs: { some: { runId } }, status: { in: ['succeeded', 'failed'] } },
		_count: { _all: true }
	})
	const count = (status: string) =>
		groups.find((group) => group.status === status)?._count._all ?? 0
	return db.run.update({
		where: { id: runId },
		data: {
			checkedCount: count('succeeded') + count('failed'),
			failedCount: count('failed'),
			countedAt: new Date()
		},
		select: { checkedCount: true, failedCount: true }
	})
}

// Answers waiting to be counted, by assessment: whether each failed.
const uncounted = new Map<string, boolean>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
// Answers are counted together this often. One update per answer had every
// call in flight queue on the run's one row (21 ms each at 100 calls at
// once), which made counting, not Jev, the slowest part of a run.
const COUNT_EVERY_MS = 250

// A pair's final answer, counted on every running run that holds it (pairs'
// answers are shared between runs of the same records and settings). Counted
// a moment later, with the answers around it: the Runs centre's progress
// trails by at most that, and finishing a run recounts it exactly, so a
// restart losing a few never shows in its results.
export function countAnswer({
	assessmentId,
	isFailed
}: {
	assessmentId: string
	isFailed: boolean
}) {
	uncounted.set(assessmentId, isFailed)
	flushTimer ??= setTimeout(() => {
		flushTimer = null
		countAnswers().catch((error: unknown) => captureError(error, { source: 'run-counts' }))
	}, COUNT_EVERY_MS)
}

async function countAnswers() {
	const answers = new Map(uncounted)
	uncounted.clear()
	if (answers.size === 0) return
	const holders = await db.runPair.findMany({
		where: {
			assessmentId: { in: [...answers.keys()] },
			run: { status: 'running', countedAt: { not: null } }
		},
		select: { runId: true, assessmentId: true }
	})
	const byRun = new Map<string, { checked: number; failed: number }>()
	for (const { runId, assessmentId } of holders) {
		const counts = byRun.get(runId) ?? { checked: 0, failed: 0 }
		counts.checked++
		if (answers.get(assessmentId) === true) counts.failed++
		byRun.set(runId, counts)
	}
	await Promise.all(
		[...byRun].map(([runId, counts]) =>
			db.run.updateMany({
				where: { id: runId, status: 'running', countedAt: { not: null } },
				data: {
					checkedCount: { increment: counts.checked },
					failedCount: { increment: counts.failed }
				}
			})
		)
	)
}

// How far a run is, from its stored counts: the same cost however many
// pairs it has, so the Runs centre can ask every second
// (docs/rules/database.md, "Bounded queries"). Why pairs failed is only read
// when some did.
export async function getRunProgress(runId: string): Promise<RunProgress> {
	const run = await db.run.findUniqueOrThrow({
		where: { id: runId },
		select: {
			status: true,
			stopReason: true,
			completedAt: true,
			waitingSince: true,
			pairCount: true,
			checkedCount: true,
			failedCount: true,
			countedAt: true
		}
	})
	const counts = run.countedAt == null ? await recountRun(runId) : run
	const failedCodes =
		counts.failedCount === 0
			? []
			: await db.assessment.groupBy({
					by: ['errorCode'],
					where: { status: 'failed', runPairs: { some: { runId } } },
					_count: { _all: true }
				})
	const byReason = new Map<FailureReason, number>()
	for (const group of failedCodes) {
		const reason = failureReason(group.errorCode)
		byReason.set(reason, (byReason.get(reason) ?? 0) + group._count._all)
	}
	return {
		status: run.status,
		stopReason: run.stopReason,
		total: run.pairCount,
		pending: Math.max(0, run.pairCount - counts.checkedCount),
		succeeded: counts.checkedCount - counts.failedCount,
		failed: counts.failedCount,
		failures: [...byReason]
			.map(([reason, count]) => ({ reason, count }))
			.sort((a, b) => b.count - a.count),
		completedAt: run.completedAt,
		waitingSince: run.status === 'running' ? run.waitingSince : null
	}
}

export async function retryFailed({ ownerId, runId }: { ownerId: string; runId: string }) {
	await getOwnedRun({ ownerId, runId })
	await db.$transaction([
		db.assessment.updateMany({
			where: { status: 'failed', runPairs: { some: { runId } } },
			data: { status: 'pending', attempts: 0, errorCode: null, nextTryAt: null }
		}),
		db.run.update({
			where: { id: runId },
			data: { status: 'running', stopReason: null, completedAt: null, waitingSince: null }
		})
	])
	// Its failed pairs are waiting again.
	await recountRun(runId)
}

// Why a run stopped because someone paused it, not because of a problem.
export const PAUSED = 'paused'

// The owner pauses a running run. The worker sees it before its next batch:
// pairs already being checked finish, the rest wait until it's resumed.
export async function pauseRun({ ownerId, runId }: { ownerId: string; runId: string }) {
	await getOwnedRun({ ownerId, runId })
	await db.run.updateMany({
		where: { id: runId, status: 'running' },
		data: { status: 'stopped', stopReason: PAUSED, waitingSince: null }
	})
}

// After a pause, or a configuration stop (the key was added or fixed). Pairs
// that were waiting to try Jev again go straight away: someone just asked.
export async function resumeRun({ ownerId, runId }: { ownerId: string; runId: string }) {
	await getOwnedRun({ ownerId, runId })
	await db.$transaction([
		db.assessment.updateMany({
			where: { status: 'pending', nextTryAt: { not: null }, runPairs: { some: { runId } } },
			data: { nextTryAt: null }
		}),
		db.run.update({
			where: { id: runId },
			data: { status: 'running', stopReason: null, completedAt: null, waitingSince: null }
		})
	])
}
