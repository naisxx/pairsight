import 'server-only'
import { AppError } from '@/lib/errors/app-error'
import { failureReason, type FailureReason } from '@/lib/pairsight/failure-reasons'
import { db } from '@/server/db/client'
import { evaluationWhere, ownerScope, type EvaluationScope } from './scope'

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

// For changes: only a run of the owner's own live evaluation.
export async function getOwnedRun({ ownerId, runId }: { ownerId: string; runId: string }) {
	return getVisibleRun({ scope: ownerScope(ownerId), runId })
}

// For reads: a run the scope may see.
export async function getVisibleRun({ scope, runId }: { scope: EvaluationScope; runId: string }) {
	const run = await db.run.findFirst({
		where: { id: runId, evaluation: evaluationWhere(scope) },
		include: { evaluation: { select: { id: true, name: true } } }
	})
	if (run == null) throw runNotFound()
	return run
}

export type RunProgress = {
	status: 'running' | 'completed' | 'stopped'
	stopReason: string | null
	total: number
	pending: number
	running: number
	succeeded: number
	failed: number
	// Failed pairs grouped by why, most common first.
	failures: Array<{ reason: FailureReason; count: number }>
}

export async function getRunProgress(runId: string): Promise<RunProgress> {
	const [run, groups, failedCodes] = await Promise.all([
		db.run.findUniqueOrThrow({ where: { id: runId }, select: { status: true, stopReason: true } }),
		db.assessment.groupBy({
			by: ['status'],
			where: { runPairs: { some: { runId } } },
			_count: { _all: true }
		}),
		db.assessment.groupBy({
			by: ['errorCode'],
			where: { status: 'failed', runPairs: { some: { runId } } },
			_count: { _all: true }
		})
	])
	const count = (status: string) =>
		groups.find((group) => group.status === status)?._count._all ?? 0
	const progress = {
		status: run.status,
		stopReason: run.stopReason,
		pending: count('pending'),
		running: count('running'),
		succeeded: count('succeeded'),
		failed: count('failed')
	}
	const byReason = new Map<FailureReason, number>()
	for (const group of failedCodes) {
		const reason = failureReason(group.errorCode)
		byReason.set(reason, (byReason.get(reason) ?? 0) + group._count._all)
	}
	return {
		...progress,
		total: progress.pending + progress.running + progress.succeeded + progress.failed,
		failures: [...byReason]
			.map(([reason, count]) => ({ reason, count }))
			.sort((a, b) => b.count - a.count)
	}
}

export async function retryFailed({ ownerId, runId }: { ownerId: string; runId: string }) {
	await getOwnedRun({ ownerId, runId })
	await db.$transaction([
		db.assessment.updateMany({
			where: { status: 'failed', runPairs: { some: { runId } } },
			data: { status: 'pending', attempts: 0, errorCode: null }
		}),
		db.run.update({
			where: { id: runId },
			data: { status: 'running', stopReason: null, completedAt: null }
		})
	])
}

// Why a run stopped because someone paused it, not because of a problem.
export const PAUSED = 'paused'

// The owner pauses a running run. The worker sees it before its next batch:
// pairs already being checked finish, the rest wait until it's resumed.
export async function pauseRun({ ownerId, runId }: { ownerId: string; runId: string }) {
	await getOwnedRun({ ownerId, runId })
	await db.run.updateMany({
		where: { id: runId, status: 'running' },
		data: { status: 'stopped', stopReason: PAUSED }
	})
}

// After a pause, or a configuration stop (the key was added or fixed).
export async function resumeRun({ ownerId, runId }: { ownerId: string; runId: string }) {
	await getOwnedRun({ ownerId, runId })
	await db.run.update({ where: { id: runId }, data: { status: 'running', stopReason: null } })
}
