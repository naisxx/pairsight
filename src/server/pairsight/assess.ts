import 'server-only'
import { env } from '@/lib/env'
import { captureError } from '@/lib/observability/capture-error'
import { requestDecision, TypesafeError } from '@/server/ai/typesafe'
import { db } from '@/server/db/client'
import { countAnswer } from './runs'
import {
	buildJevRequest,
	classifyFailure,
	JEV_FEATURE,
	parseJevAnswer,
	waitBeforeRetryMs,
	type JudgmentConfig
} from './judgment'
import { jevLimiter } from './worker/jev-limiter'

// Judges one claimed assessment with Jev (docs/PairSight-Scale-Roadmap.md,
// item 4). Nothing passing can fail a pair:
// - Jev busy, down, slow or unreachable (`wait`): the pair is released at
//   once with a time to try again (`nextTryAt`), as often as it takes, and
//   the shared limiter slows every call down.
// - The key rejected (`access`): the same, unless it has lasted a while, then
//   the run stops for someone to fix it. A missing key stops it at once.
// - An answer without a usable score: asked again straight away, a few times.
// - Our own database failing: the pair stays claimed and is picked up again
//   once its claim is stale (run-engine.ts, STALE_CLAIM_MS).
// Only Jev refusing the pair (400/413/422), or a usable answer never
// arriving, fails it.
//
// `once` is a re-check someone is waiting for on the pair page: it isn't
// left to the run loop, so whatever stops it puts the pair back as failed,
// to be tried again by hand.

const ANSWER_TRIES = 3
// How long Jev may keep rejecting the key before a run stops: long enough for
// a gateway blip, short enough that a wrong key is caught within minutes.
const ACCESS_GRACE_MS = 60_000

export class RunStopped extends Error {}

// When Jev started refusing the key, per run; cleared by the run's next answer.
const accessRefusedSince = new Map<string, number>()

export function limiter() {
	return jevLimiter({
		start: env.RUN_WORKER_CONCURRENCY,
		max: env.RUN_WORKER_CONCURRENCY_MAX
	})
}

export type AssessOutcome = 'answered' | 'waiting' | 'held'

export async function assess({
	assessmentId,
	runId,
	config,
	recordA,
	recordB,
	once = false
}: {
	assessmentId: string
	runId: string
	config: JudgmentConfig
	recordA: Record<string, string>
	recordB: Record<string, string>
	once?: boolean
}): Promise<AssessOutcome> {
	const request = buildJevRequest({ recordA, recordB, config })
	const slots = limiter()
	try {
		for (let answerTry = 1; ; answerTry++) {
			// Each call renews the claim, so a slow pair is never mistaken for an
			// abandoned one.
			const { attempts } = await db.assessment.update({
				where: { id: assessmentId },
				data: { attempts: { increment: 1 }, claimedAt: new Date() },
				select: { attempts: true }
			})
			let body: unknown
			try {
				body = await requestDecision(
					{
						feature: JEV_FEATURE,
						model: config.model,
						meta: { run_id: runId, assessment_id: assessmentId }
					},
					request
				)
			} catch (error) {
				if (!(error instanceof TypesafeError)) throw error
				return await onFailure({ error, runId, assessmentId, attempts, once })
			}
			// Jev was reachable and answered, whatever the answer says.
			slots.answered()
			accessRefusedSince.delete(runId)
			const answer = parseJevAnswer(body, config.entityType)
			if (!answer.ok && answerTry < ANSWER_TRIES) continue
			await db.assessment.update({
				where: { id: assessmentId },
				data: answer.ok
					? {
							status: 'succeeded',
							score: answer.score,
							modelReported: answer.modelReported,
							errorCode: null,
							nextTryAt: null,
							completedAt: new Date()
						}
					: { status: 'failed', errorCode: answer.code, nextTryAt: null, completedAt: new Date() }
			})
			countAnswer({ assessmentId, isFailed: !answer.ok })
			return 'answered'
		}
	} catch (error) {
		if (error instanceof RunStopped) throw error
		// Our side (the database, mostly): the pair keeps its claim and is
		// taken again once that's stale. Never a failed pair. A re-check has
		// no run loop to take it again, so it goes back as it was, if it can.
		captureError(error, { runId, assessmentId })
		if (once) await putBack(assessmentId, 'unexpected').catch(() => undefined)
		return 'held'
	}
}

async function onFailure({
	error,
	runId,
	assessmentId,
	attempts,
	once
}: {
	error: TypesafeError
	runId: string
	assessmentId: string
	attempts: number
	once: boolean
}): Promise<AssessOutcome> {
	const code = error.status != null ? `http_${error.status}` : error.kind
	const action = classifyFailure({ kind: error.kind, status: error.status })
	if (action === 'fail') {
		limiter().answered()
		await markFailed(assessmentId, code)
		return 'answered'
	}
	if (action === 'access') {
		// Not Jev being busy, so it doesn't slow other runs down.
		const now = Date.now()
		const since = accessRefusedSince.get(runId) ?? now
		accessRefusedSince.set(runId, since)
		const isMissing = error.status == null
		if (isMissing || now - since >= ACCESS_GRACE_MS) {
			accessRefusedSince.delete(runId)
			await putBack(assessmentId, once ? code : null)
			throw new RunStopped(isMissing ? 'missing_key' : 'invalid_key')
		}
	} else {
		limiter().busy(error.retryAfterMs)
	}
	if (once) {
		await putBack(assessmentId, code)
		return 'waiting'
	}
	const wait = waitBeforeRetryMs({ attempts, retryAfterMs: error.retryAfterMs })
	await db.assessment.update({
		where: { id: assessmentId },
		data: { status: 'pending', claimedAt: null, nextTryAt: new Date(Date.now() + wait) }
	})
	return 'waiting'
}

// A pair the run loop will take again (`errorCode` null), or a re-check put
// back as failed, as it was before.
async function putBack(assessmentId: string, errorCode: string | null) {
	await db.assessment.update({
		where: { id: assessmentId },
		data:
			errorCode == null
				? { status: 'pending', claimedAt: null }
				: { status: 'failed', errorCode, claimedAt: null, completedAt: new Date() }
	})
}

async function markFailed(assessmentId: string, errorCode: string) {
	await db.assessment.update({
		where: { id: assessmentId },
		data: { status: 'failed', errorCode, nextTryAt: null, completedAt: new Date() }
	})
	countAnswer({ assessmentId, isFailed: true })
}
