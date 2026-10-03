import 'server-only'
import { captureError } from '@/lib/observability/capture-error'
import { requestDecision, TypesafeError } from '@/server/ai/typesafe'
import { db } from '@/server/db/client'
import {
	buildJevRequest,
	classifyFailure,
	JEV_FEATURE,
	parseJevAnswer,
	type JudgmentConfig
} from './judgment'

// Judges one assessment with Jev: 429/529/5xx, timeouts and network errors are
// retried with backoff; a 422 or an answer without a documented score fails
// the pair; a configuration problem (missing or rejected key) releases it and
// stops the whole run.

const MAX_ATTEMPTS = 3
const RETRY_BACKOFF_MS = [1_000, 3_000]

export class RunStopped extends Error {}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function assess({
	assessmentId,
	runId,
	config,
	recordA,
	recordB
}: {
	assessmentId: string
	runId: string
	config: JudgmentConfig
	recordA: Record<string, string>
	recordB: Record<string, string>
}) {
	const request = buildJevRequest({ recordA, recordB, config })
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		// Each attempt renews the claim, so a slow pair is never mistaken for an
		// abandoned one (run-engine.ts, STALE_CLAIM_MS).
		await db.assessment.update({
			where: { id: assessmentId },
			data: { attempts: { increment: 1 }, claimedAt: new Date() }
		})
		try {
			const body = await requestDecision(
				{
					feature: JEV_FEATURE,
					model: config.model,
					meta: { run_id: runId, assessment_id: assessmentId }
				},
				request
			)
			const answer = parseJevAnswer(body, config.entityType)
			await db.assessment.update({
				where: { id: assessmentId },
				data: answer.ok
					? {
							status: 'succeeded',
							score: answer.score,
							modelReported: answer.modelReported,
							errorCode: null,
							completedAt: new Date()
						}
					: { status: 'failed', errorCode: answer.code, completedAt: new Date() }
			})
			return
		} catch (error) {
			if (!(error instanceof TypesafeError)) {
				captureError(error, { runId, assessmentId })
				await markFailed(assessmentId, 'unexpected')
				return
			}
			const action = classifyFailure({ kind: error.kind, status: error.status })
			if (action === 'stop_run') {
				await db.assessment.update({
					where: { id: assessmentId },
					data: { status: 'pending', claimedAt: null }
				})
				throw new RunStopped(
					error.kind === 'config' && error.status === 401 ? 'invalid_key' : 'missing_key'
				)
			}
			const code = error.status != null ? `http_${error.status}` : error.kind
			if (action === 'fail' || attempt === MAX_ATTEMPTS) {
				await markFailed(assessmentId, code)
				return
			}
			await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? RETRY_BACKOFF_MS.at(-1) ?? 0)
		}
	}
}

async function markFailed(assessmentId: string, errorCode: string) {
	await db.assessment.update({
		where: { id: assessmentId },
		data: { status: 'failed', errorCode, completedAt: new Date() }
	})
}
